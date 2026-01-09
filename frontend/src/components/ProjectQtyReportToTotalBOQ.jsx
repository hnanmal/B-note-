import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

const baseHeaders = [
  'Work Master Code',
  'Gauge Code',
  'Description',
  'Spec.',
  'Additional Spec.',
  'Reference to',
  'UoM',
  'Total',
];

export default function ProjectQtyReportToTotalBOQ({ apiBaseUrl }) {
  const [buildingNames, setBuildingNames] = useState([]);
  const [revKeys, setRevKeys] = useState([]);
  const [selectedRevKey, setSelectedRevKey] = useState('');
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [aggregatedRows, setAggregatedRows] = useState([]);
  const [midOrder, setMidOrder] = useState({});
  const [pjtAbbr, setPjtAbbr] = useState('');

  useEffect(() => {
    if (!apiBaseUrl) return;
    // building names (existing behavior)
    fetch(`${apiBaseUrl}/calc-result/buildings`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const seen = new Set();
          const ordered = data.filter(b => {
            if (!b || seen.has(b)) return false;
            seen.add(b);
            return true;
          });
          setBuildingNames(ordered);
        }
      })
      .catch(() => {});

    // fetch rev keys for dropdown (safe, non-blocking)
    fetch(`${apiBaseUrl}/calc-result/rev-keys`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRevKeys(data);
      })
      .catch(() => {});

    // fetch project abbreviation for filename
    fetch(`${apiBaseUrl}/metadata/abbr`)
      .then(r => (r.ok ? r.json().catch(() => null) : null))
      .then(md => {
        if (md && md.pjt_abbr) setPjtAbbr(String(md.pjt_abbr));
      })
      .catch(() => {});
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    if (!selectedRevKey) {
      setAggregatedRows([]);
      return;
    }

    const qs = `?rev_key=${encodeURIComponent(selectedRevKey)}&limit=20000`;
    fetch(`${apiBaseUrl}/calc-result${qs}`)
      .then(res => {
        if (!res.ok) return [];
        return res.json().catch(() => []);
      })
      .then(data => {
          const rows = Array.isArray(data) ? data : [];
          // collect available buildings for this selected rev
          try {
            const bset = new Set();
            for (const r of rows) {
              if (r && r.building_name) bset.add(r.building_name);
            }
            setAvailableBuildings(Array.from(bset));
          } catch (e) {
            setAvailableBuildings([]);
          }
          // reset building filter when rev changes
          setSelectedBuilding('');
        // aggregate by wm_code + gauge
        const map = new Map();
        for (const r of rows) {
          const code = (r.wm_code || '').trim();
          // skip rows without Work Master Code
          if (!code) continue;
          const gauge = (r.gauge || '').trim();
          const key = `${code}||${gauge}`;
          const building = r.building_name || '';
          const qty = Number(r.result) || 0;
          const cat = (r.cat_large_desc || r.category || '').trim();
          if (!map.has(key)) {
            map.set(key, {
              wm_code: code,
              gauge: gauge,
              description: r.description || '',
              spec: r.spec || '',
              add_spec: r.add_spec || '',
              // reference column intentionally left empty
              reference_to: '',
              uom: r.unit || r.uom || '',
              total: 0,
              byBuilding: {},
              cat_large_desc: cat,
            });
          }
          const item = map.get(key);
          item.total = (item.total || 0) + qty;
          item.byBuilding[building] = (item.byBuilding[building] || 0) + qty;
        }

        const out = Array.from(map.values());
        // sort by wm_code
        out.sort((a, b) => (a.wm_code || '').localeCompare(b.wm_code || ''));
        // try to enrich items with cat_large_desc by looking up work_masters
        const normalize = (s) => (s || '').toString().trim();
        fetch(`${apiBaseUrl}/work-masters/`)
          .then((r) => (r.ok ? r.json().catch(() => []) : []))
          .then((wms) => {
            const wmMap = new Map();
            const largeMidMap = new Map();
            if (Array.isArray(wms)) {
              for (const wm of wms) {
                const key = `${normalize(wm.work_master_code)}||${normalize(wm.gauge)}`;
                wmMap.set(key, wm);
                const large = normalize(wm.cat_large_desc || wm.cat_large_code || '');
                const mid = normalize(wm.cat_mid_desc || wm.cat_mid_code || '');
                if (!largeMidMap.has(large)) largeMidMap.set(large, new Set());
                if (mid) largeMidMap.get(large).add(mid);
              }
              // convert largeMidMap to plain object with ordered arrays
              const midOrderObj = {};
              for (const [large, mids] of largeMidMap.entries()) {
                midOrderObj[large] = Array.from(mids);
              }
              setMidOrder(midOrderObj);
            }

            for (const item of out) {
              const key = `${normalize(item.wm_code)}||${normalize(item.gauge)}`;
              let wm = wmMap.get(key);
              if (!wm) {
                // try uppercase gauge fallback
                wm = wmMap.get(`${normalize(item.wm_code)}||${normalize(item.gauge).toUpperCase()}`) || wmMap.get(`${normalize(item.wm_code).toUpperCase()}||${normalize(item.gauge).toUpperCase()}`);
              }
              item.cat_large_desc = (wm && (wm.cat_large_desc || wm.cat_large_code || '')) || item.cat_large_desc || '';
              // also populate mid category from work_masters
              item.cat_mid_desc = (wm && (wm.cat_mid_desc || wm.cat_mid_code || '')) || item.cat_mid_desc || '';
              // Use work_masters.cat_small_desc as Description when available
              if (wm && (wm.cat_small_desc || wm.cat_small_code)) {
                item.description = wm.cat_small_desc || wm.cat_small_code || item.description || '';
              }
              // Use work_masters.add_spec as Additional Spec. when available
              if (wm && wm.add_spec) {
                item.add_spec = wm.add_spec || item.add_spec || '';
              }
            }

            const grouped = new Map();
            for (const item of out) {
              const g = item.cat_large_desc || '';
              if (!grouped.has(g)) grouped.set(g, []);
              grouped.get(g).push(item);
            }
            setAggregatedRows(Array.from(grouped.entries()));
          })
          .catch(() => {
            const grouped = new Map();
            for (const item of out) {
              const g = item.cat_large_desc || '';
              if (!grouped.has(g)) grouped.set(g, []);
              grouped.get(g).push(item);
            }
            setAggregatedRows(Array.from(grouped.entries()));
          });
      })
      .catch(() => setAggregatedRows([]));
  }, [apiBaseUrl, selectedRevKey]);

  const displayedBuildings = selectedBuilding ? [selectedBuilding] : buildingNames;

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // build header row
      const headers = [...baseHeaders, ...displayedBuildings];
      const data = [headers];

      // helper to produce numeric values (rounded to 3 decimals) for numeric cells
      const numVal = (v) => {
        if (v == null || v === '') return 0;
        const n = Number(v) || 0;
        return Math.round(n * 1000) / 1000;
      };
      // string formatter for non-numeric display cells when needed
      const fmtStr = (v) => {
        if (v == null || v === '') return '';
        return Number.isInteger(v) ? String(v) : Number(v).toFixed(3);
      };

      for (const [groupName, items] of aggregatedRows) {
        // group header row
        const gh = new Array(headers.length).fill('');
        gh[2] = groupName || '(Uncategorized)';
        data.push(gh);

        // group mid mapping and ordering
        const midMap = new Map();
        for (const it of items) {
          const mid = (it.cat_mid_desc || '').trim();
          if (!midMap.has(mid)) midMap.set(mid, []);
          midMap.get(mid).push(it);
        }
        const midsForLarge = (midOrder && midOrder[groupName]) || [];
        const allMids = Array.from(midMap.keys());
        const remaining = allMids.filter(m => !midsForLarge.includes(m)).sort((a,b)=> (a||'').localeCompare(b||''));
        const orderedMidNames = [
          ...midsForLarge.filter(m => midMap.has(m)),
          ...remaining,
        ];

        for (const midName of orderedMidNames) {
          const midRow = new Array(headers.length).fill('');
          midRow[2] = midName || '(Uncategorized Mid)';
          data.push(midRow);

          const rows = midMap.get(midName) || [];
          for (const row of rows) {
            const r = [
              row.wm_code || '',
              row.gauge || '',
              row.description || '',
              row.spec || '',
              row.add_spec || '',
              row.reference_to || '',
              row.uom || '',
              numVal(row.total),
            ];
            for (const b of displayedBuildings) r.push(numVal((row.byBuilding && row.byBuilding[b]) || 0));
            data.push(r);
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(data);

      // apply simple styles: headers, group header, mid header, and numeric formatting
      const range = XLSX.utils.decode_range(ws['!ref']);
      const headerFill = { fgColor: { rgb: 'F7C748' } };
      const groupFill = { fgColor: { rgb: 'E6F9E6' } };
      const midFill = { fgColor: { rgb: 'FFF9E6' } };
      const numFmt = '#,##0.###';

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          let cell = ws[cellAddress];
          // ensure cell exists for numeric columns so we can style them
          if (!cell) {
            // if this is a numeric column (Total or building cols), create zero cell
            if (R > 0 && C >= 7) {
              cell = { t: 'n', v: 0 };
              ws[cellAddress] = cell;
            } else {
              continue;
            }
          }

          // convert numeric-looking strings to numbers for proper formatting
          if (cell.t === 's' || typeof cell.v === 'string') {
            const parsed = parseFloat(String(cell.v).replace(/,/g, ''));
            if (!Number.isNaN(parsed) && C >= 7) {
              cell.v = Math.round(parsed * 1000) / 1000;
              cell.t = 'n';
            }
          }

          // header row
          if (R === 0) {
            cell.s = cell.s || {};
            cell.s.font = { bold: true, color: { rgb: '2C1B00' } };
            cell.s.fill = headerFill;
          }

          // numeric columns: Total (C===7) and building columns (C>=8)
          if (R >= 1 && C >= 7) {
            cell.s = cell.s || {};
            cell.s.numFmt = numFmt;
            cell.s.alignment = { horizontal: 'right' };
          }
        }
      }

      // Post-process to style group and mid headers by simple heuristic: rows where first two cols empty and desc is set and Total col empty
      for (let R = 1; R <= range.e.r; ++R) {
        const c0 = XLSX.utils.encode_cell({ r: R, c: 0 });
        const c1 = XLSX.utils.encode_cell({ r: R, c: 1 });
        const c7 = XLSX.utils.encode_cell({ r: R, c: 7 });
        const descCell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
        const v0 = ws[c0] && String(ws[c0].v || '').trim();
        const v1 = ws[c1] && String(ws[c1].v || '').trim();
        const v7 = ws[c7] && (ws[c7].t === 'n' ? String(ws[c7].v) : String(ws[c7].v || '')).trim();
        if ((!v0 && !v1) && descCell && (!v7 || v7 === '0')) {
          const nextRow = R + 1;
          const nextC0 = ws[XLSX.utils.encode_cell({ r: nextRow, c: 0 })];
          const isMid = nextC0 && nextC0.v;
          const fill = isMid ? midFill : groupFill;
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const ca = XLSX.utils.encode_cell({ r: R, c: C });
            const cc = ws[ca];
            if (!cc) continue;
            cc.s = cc.s || {};
            cc.s.fill = fill;
            cc.s.font = { bold: true };
          }
        }
      }

      // column widths approximate
      const colWidths = [];
      for (let i = 0; i < headers.length; ++i) {
        if (i === 0) colWidths.push({ wch: 18 });
        else if (i === 1) colWidths.push({ wch: 6 });
        else if (i === 2) colWidths.push({ wch: 35 });
        else colWidths.push({ wch: 12 });
      }
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'QtyReport');
      // filename: "프로젝트약호_Total BOQ_rev(리비전 정보)"
      const abbr = (pjtAbbr || '프로젝트').replace(/\s+/g, '_');
      const revPart = selectedRevKey ? String(selectedRevKey) : 'rev';
      const fileName = `${abbr}_Total BOQ_rev(${revPart}).xlsx`;
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });
    } catch (e) {
      console.error('Export failed', e);
      alert('Excel export failed. See console for details.');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#d97706' }}>
          Q'ty Report to Total BOQ
        </div>
        <div>
          <select
            value={selectedRevKey}
            onChange={e => setSelectedRevKey(e.target.value)}
            style={{ height: 28, fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 140 }}
          >
            <option value="">rev 선택</option>
            {revKeys.map((rev) => (
              <option key={rev} value={rev}>{rev}</option>
            ))}
          </select>
        </div>
        
        <div>
          <select
            value={selectedBuilding}
            onChange={e => setSelectedBuilding(e.target.value)}
            disabled={!selectedRevKey || !availableBuildings.length}
            style={{ height: 28, fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 180 }}
          >
            <option value="">All buildings</option>
            {availableBuildings.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => exportToExcel()}
            disabled={!aggregatedRows.length}
            style={{ height: 28, fontSize: 13, padding: '0 10px', borderRadius: 6, border: '1px solid #374151', background: '#fff', cursor: 'pointer' }}
            title="Export current sheet to Excel (with styles)"
          >
            Export to Excel
          </button>
        </div>
      </div>
      <div style={{ flex: '1 1 auto', overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f7c748', color: '#2c1b00' }}>
            {baseHeaders.map((h, i) => {
              const thStyle = { padding: '6px 4px', border: '1px solid #e5e7eb', fontWeight: 700 };
              if (i === 0) { thStyle.minWidth = 140; thStyle.maxWidth = 140; } // Work Master Code (approx 15 chars)
              if (i === 1) { thStyle.minWidth = 40; thStyle.maxWidth = 40; } // Gauge Code very narrow
              if (i === 2) { thStyle.minWidth = 200; thStyle.maxWidth = 400; } // Description slightly wider (~+5 chars)
              return <th key={h} style={thStyle}>{h}</th>;
            })}
            {displayedBuildings.map((b) => (
              <th key={b} style={{ padding: '6px 4px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(!selectedRevKey) ? (
            <tr>
              <td colSpan={baseHeaders.length + displayedBuildings.length} style={{ textAlign: 'center', color: '#bbb', padding: 20 }}>
                리비전을 선택하세요.
              </td>
            </tr>
          ) : aggregatedRows.length === 0 ? (
            <tr>
              <td colSpan={baseHeaders.length + displayedBuildings.length} style={{ textAlign: 'center', color: '#bbb', padding: 20 }}>
                선택된 리비전에 해당하는 데이터가 없습니다.
              </td>
            </tr>
          ) : (
            aggregatedRows.map(([groupName, items], groupIdx) => {
              const fmt = (v) => {
                if (v == null || v === '') return '';
                return Number.isInteger(v) ? String(v) : (Number(v).toFixed(3));
              };
              return (
                // fragment for group header + rows
                <React.Fragment key={`group-${groupIdx}-${groupName}`}>
                  <tr style={{ background: '#e6f9e6' }}>
                      {/* empty cells for first two columns */}
                      <td style={{ padding: '1px 6px', border: '1px solid #f3f4f6', minWidth: 140, maxWidth:140 }}></td>
                      <td style={{ padding: '1px 6px', border: '1px solid #f3f4f6', minWidth: 40, maxWidth:40 }}></td>
                      <td style={{ padding: '3px 6px', border: '1px solid #e6e6e6', fontWeight: 700, minWidth: 200 }}>
                        {groupName || '(Uncategorized)'}
                      </td>
                    {/* remaining base header cells (Description already used) */}
                      {Array.from({ length: baseHeaders.length - 3 }).map((_, i) => (
                      <td key={`gh-${groupIdx}-${i}`} style={{ padding: '1px 6px', border: '1px solid #f3f4f6' }}></td>
                    ))}
                    {displayedBuildings.map((b) => (
                      <td key={`gh-b-${groupIdx}-${b}`} style={{ padding: '2px 6px', border: '1px solid #f3f4f6' }}></td>
                    ))}
                  </tr>
                        {(() => {
                          // Group items by mid-category inside this large group
                          const midMap = new Map();
                          for (const it of items) {
                            const mid = (it.cat_mid_desc || '').trim();
                            if (!midMap.has(mid)) midMap.set(mid, []);
                            midMap.get(mid).push(it);
                          }

                          // build ordered mid entries: prefer DB order from midOrder, then append any remaining mids sorted
                          const midsForLarge = (midOrder && midOrder[groupName]) || [];
                          const allMids = Array.from(midMap.keys());
                          const remaining = allMids.filter(m => !midsForLarge.includes(m)).sort((a,b)=> (a||'').localeCompare(b||''));
                          const orderedMidNames = [
                            ...midsForLarge.filter(m => midMap.has(m)),
                            ...remaining,
                          ];

                          const midEntries = orderedMidNames.map((m) => [m, midMap.get(m)]);

                          return midEntries.map(([midName, midItems], midIdx) => {
                            // filter rows by selected building if needed
                            const filtered = midItems.filter(it => {
                              if (!selectedBuilding) return true;
                              return Number((it.byBuilding && it.byBuilding[selectedBuilding]) || 0) > 0;
                            });
                            if (!filtered.length) return null;

                            return (
                              <React.Fragment key={`group-${groupIdx}-mid-${midIdx}-${midName}`}>
                                <tr style={{ background: '#fff9e6' }}>
                                  <td style={{ padding: '2px 6px', border: '1px solid #f3f4f6', minWidth: 140, maxWidth:140 }}></td>
                                  <td style={{ padding: '2px 6px', border: '1px solid #f3f4f6', minWidth: 40, maxWidth:40 }}></td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #e6e6e6', fontWeight: 600, minWidth: 200 }}>
                                    {midName || '(Uncategorized Mid)'}
                                  </td>
                                  {Array.from({ length: baseHeaders.length - 3 }).map((_, i) => (
                                    <td key={`mh-${groupIdx}-${midIdx}-${i}`} style={{ padding: '1px 6px', border: '1px solid #f3f4f6' }}></td>
                                  ))}
                                  {displayedBuildings.map((b) => (
                                    <td key={`mh-b-${groupIdx}-${midIdx}-${b}`} style={{ padding: '1px 6px', border: '1px solid #f3f4f6' }}></td>
                                  ))}
                                </tr>
                                {filtered.map((row, idx) => (
                                  <tr key={`${row.wm_code}||${row.gauge}||${groupIdx}||${midIdx}||${idx}`}>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6', minWidth: 140, maxWidth:140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.wm_code}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6', minWidth: 40, maxWidth:40, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.gauge}</td>
                                    <td style={{ padding: '3px 6px', border: '1px solid #f3f4f6', minWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.description}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6' }}>{row.spec}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6' }}>{row.add_spec || ''}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6' }}>{row.reference_to}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6' }}>{row.uom}</td>
                                    <td style={{ padding: '4px 6px', border: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt(row.total)}</td>
                                    {displayedBuildings.map((b) => (
                                      <td key={`val-${groupIdx}-${midIdx}-${idx}-${b}`} style={{ padding: '4px 6px', border: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt(row.byBuilding[b] || 0)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          });
                        })()}
                </React.Fragment>
              );
            })
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

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
              spec: r.spec || r.add_spec || '',
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
            if (Array.isArray(wms)) {
              for (const wm of wms) {
                const key = `${normalize(wm.work_master_code)}||${normalize(wm.gauge)}`;
                wmMap.set(key, wm);
              }
            }

            for (const item of out) {
              const key = `${normalize(item.wm_code)}||${normalize(item.gauge)}`;
              let wm = wmMap.get(key);
              if (!wm) {
                // try uppercase gauge fallback
                wm = wmMap.get(`${normalize(item.wm_code)}||${normalize(item.gauge).toUpperCase()}`) || wmMap.get(`${normalize(item.wm_code).toUpperCase()}||${normalize(item.gauge).toUpperCase()}`);
              }
              item.cat_large_desc = (wm && (wm.cat_large_desc || wm.cat_large_code || '')) || item.cat_large_desc || '';
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
            style={{ height: 32, fontSize: 15, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 140 }}
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
            style={{ height: 32, fontSize: 15, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 180 }}
          >
            <option value="">All buildings</option>
            {availableBuildings.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ flex: '1 1 auto', overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f7c748', color: '#2c1b00' }}>
            {baseHeaders.map((h) => (
              <th key={h} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
            ))}
            {displayedBuildings.map((b) => (
              <th key={b} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(!selectedRevKey) ? (
            <tr>
              <td colSpan={baseHeaders.length + displayedBuildings.length} style={{ textAlign: 'center', color: '#bbb', padding: 32 }}>
                리비전을 선택하세요.
              </td>
            </tr>
          ) : aggregatedRows.length === 0 ? (
            <tr>
              <td colSpan={baseHeaders.length + displayedBuildings.length} style={{ textAlign: 'center', color: '#bbb', padding: 32 }}>
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
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}></td>
                      <td style={{ padding: '8px 10px', border: '1px solid #e6e6e6', fontWeight: 700 }}>
                        {groupName || '(Uncategorized)'}
                      </td>
                    {/* remaining base header cells (Description already used) */}
                    {Array.from({ length: baseHeaders.length - 3 }).map((_, i) => (
                      <td key={`gh-${groupIdx}-${i}`} style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}></td>
                    ))}
                    {displayedBuildings.map((b) => (
                      <td key={`gh-b-${groupIdx}-${b}`} style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}></td>
                    ))}
                  </tr>
                        {(() => {
                          const filtered = items.filter(it => {
                            if (!selectedBuilding) return true;
                            return Number((it.byBuilding && it.byBuilding[selectedBuilding]) || 0) > 0;
                          });
                          if (!filtered.length) return null;
                          return filtered.map((row, idx) => (
                    <tr key={`${row.wm_code}||${row.gauge}||${groupIdx}||${idx}`}>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.wm_code}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.gauge}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.description}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.spec}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{''}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.reference_to}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6' }}>{row.uom}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt(row.total)}</td>
                      {displayedBuildings.map((b) => (
                        <td key={`val-${groupIdx}-${idx}-${b}`} style={{ padding: '6px 8px', border: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt(row.byBuilding[b] || 0)}</td>
                      ))}
                    </tr>
                          ));
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

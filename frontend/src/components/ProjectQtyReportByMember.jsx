import React, { useMemo, useState } from 'react';

const asArray = (value) => (Array.isArray(value) ? value : []);
const safeText = (value) => (value == null ? '' : String(value));
const normalizeKey = (value) => safeText(value).trim();

const extractRowsFromJson = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const entries = payload.workmaster_cart_entries ?? payload.workMasterCartEntries;
    if (Array.isArray(entries)) return entries;
  }
  return [];
};

const get = (row, ...keys) => {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value != null && value !== '') return value;
    }
  }
  return null;
};

export default function ProjectQtyReportByMember() {
  const [rawRows, setRawRows] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    standardTypeNumber: '',
    standardTypeName: '',
    classification: '',
    detailClassification: '',
  });

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const rows = extractRowsFromJson(json);
      if (!rows.length) {
        setRawRows([]);
        setLoadError('JSON에서 row 배열을 찾지 못했습니다.');
        return;
      }
      setRawRows(rows);
    } catch (error) {
      setRawRows([]);
      setLoadError(error instanceof Error ? error.message : 'JSON을 불러오지 못했습니다.');
    } finally {
      event.target.value = '';
    }
  };

  const normalizedRows = useMemo(() =>
    asArray(rawRows)
      .filter(Boolean)
      .map((row, idx) => {
        const workMaster = row.work_master ?? row.workMaster ?? null;
        return {
          _idx: idx,
          category: get(row, '카테고리', 'category'),
          standardTypeNumber: get(row, '표준타입 번호', 'standard_type_number', 'standardTypeNumber'),
          standardTypeName: get(row, '표준타입 이름', 'standard_type_name', 'standardTypeName'),
          classification: get(row, '분류', 'classification'),
          detailClassification: get(row, '상세분류', 'detail_classification', 'detailClassification'),
          unit: get(row, '단위', 'unit'),
          guid: get(row, 'GUID', 'guid'),
          gui: get(row, 'GUI', 'gui'),
          name: get(row, 'name', '이름', 'standard_item_name', 'standardItemName'),
          formula: get(row, '수식', 'formula'),
          substitutedFormula: get(row, '대입수식', 'substituted_formula', 'substitutedFormula'),
          result: get(row, '산출결과', 'result'),
          resultLog: get(row, '산출로그', 'result_log', 'resultLog'),
          wmCode: get(workMaster, 'work_master_code', 'workMasterCode', 'wm_code', 'wmCode'),
          gauge: get(workMaster, 'gauge'),
          description: get(workMaster, 'description', 'Description'),
          spec: get(workMaster, 'add_spec', 'spec'),
          addSpec: get(workMaster, 'add_spec', 'add_spec_2', 'addSpec'),
        };
      }),
  [rawRows]);

  const options = useMemo(() => {
    const uniq = (key) =>
      Array.from(
        new Set(normalizedRows.map((r) => normalizeKey(r[key])).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
    return {
      category: uniq('category'),
      standardTypeNumber: uniq('standardTypeNumber'),
      standardTypeName: uniq('standardTypeName'),
      classification: uniq('classification'),
      detailClassification: uniq('detailClassification'),
    };
  }, [normalizedRows]);

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return normalizedRows.filter((row) => {
      if (filters.category && normalizeKey(row.category) !== filters.category) return false;
      if (filters.standardTypeNumber && normalizeKey(row.standardTypeNumber) !== filters.standardTypeNumber) return false;
      if (filters.standardTypeName && normalizeKey(row.standardTypeName) !== filters.standardTypeName) return false;
      if (filters.classification && normalizeKey(row.classification) !== filters.classification) return false;
      if (filters.detailClassification && normalizeKey(row.detailClassification) !== filters.detailClassification) return false;
      if (!needle) return true;
      const haystack = [
        row.category,
        row.standardTypeNumber,
        row.standardTypeName,
        row.classification,
        row.detailClassification,
        row.name,
        row.gui,
        row.guid,
        row.wmCode,
        row.description,
      ]
        .map((v) => safeText(v).toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [filters, normalizedRows, searchText]);

  const clearFilters = () => {
    setFilters({
      category: '',
      standardTypeNumber: '',
      standardTypeName: '',
      classification: '',
      detailClassification: '',
    });
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Qty Report by Member</div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: '#6b7280' }}>Load JSON</span>
          <input type="file" accept="application/json" onChange={handleFileChange} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={clearFilters}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
        >
          Clear Filters
        </button>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search"
          style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #d1d5db', minWidth: 220 }}
        />
        <button
          type="button"
          onClick={() => setSearchText('')}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
        >
          Clear Search
        </button>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          Rows: {filteredRows.length}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="">카테고리(전체)</option>
          {options.category.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={filters.standardTypeNumber} onChange={(e) => setFilters((p) => ({ ...p, standardTypeNumber: e.target.value }))}>
          <option value="">표준타입 번호(전체)</option>
          {options.standardTypeNumber.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={filters.standardTypeName} onChange={(e) => setFilters((p) => ({ ...p, standardTypeName: e.target.value }))}>
          <option value="">표준타입 이름(전체)</option>
          {options.standardTypeName.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={filters.classification} onChange={(e) => setFilters((p) => ({ ...p, classification: e.target.value }))}>
          <option value="">분류(전체)</option>
          {options.classification.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={filters.detailClassification} onChange={(e) => setFilters((p) => ({ ...p, detailClassification: e.target.value }))}>
          <option value="">상세분류(전체)</option>
          {options.detailClassification.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {loadError && (
        <div style={{ color: '#b91c1c', fontSize: 12 }}>{loadError}</div>
      )}

      <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
        Dynamo에서 물량 산출을 하기 전, 반드시 B-note의 현재 상태를 저장해 주세요!
      </div>

      <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {[
                '#',
                '카테고리',
                '표준타입 번호',
                '표준타입 이름',
                '분류',
                'GUI',
                '상세분류',
                'wm_code',
                'gauge',
                'Description',
                'Spec',
                '수식',
                '대입수식',
                '산출결과',
                '단위',
              ].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={row._idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{i + 1}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.category) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.standardTypeNumber) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.standardTypeName) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.classification) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.gui) || safeText(row.guid) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.detailClassification) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.wmCode) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.gauge) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 200 }}>{safeText(row.description) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 160 }}>{safeText(row.spec) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 200 }}>{safeText(row.formula) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 220 }}>{safeText(row.substitutedFormula) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{row.result ?? '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.unit) || '—'}</td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={15} style={{ padding: 14, color: '#6b7280' }}>
                  데이터가 없습니다. 상단의 Load JSON으로 파일을 불러오세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';

const asArray = (value) => (Array.isArray(value) ? value : []);
const safeText = (value) => (value == null ? '' : String(value));
const normalizeKey = (value) => safeText(value).trim();

export default function ProjectQtyReportByMember({ apiBaseUrl }) {
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [importing, setImporting] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    standardTypeNumber: '',
    standardTypeName: '',
    classification: '',
    detailClassification: '',
  });

  const fetchRows = async (nextBuildingName = buildingName) => {
    if (!apiBaseUrl) return;
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20000');
      if (nextBuildingName) params.set('building_name', nextBuildingName);
      const response = await fetch(`${apiBaseUrl}/calc-result?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'DB에서 산출 결과를 불러오지 못했습니다.';
        throw new Error(message);
      }
      const data = await response.json();
      setRows(asArray(data));
    } catch (error) {
      setRows([]);
      setLoadError(error instanceof Error ? error.message : 'DB에서 산출 결과를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    fetchRows('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!apiBaseUrl) return;
    setLoadError(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${apiBaseUrl}/calc-result/import-json`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'JSON Import에 실패했습니다.';
        throw new Error(message);
      }
      const result = await response.json();
      const nextBuildingName = safeText(result?.building_name || result?.buildingName || '').trim();
      setBuildingName(nextBuildingName);
      await fetchRows(nextBuildingName);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'JSON Import에 실패했습니다.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const normalizedRows = useMemo(() =>
    asArray(rows)
      .filter(Boolean)
      .map((row, idx) => ({
        _idx: row.id ?? idx,
        createdAt: row.created_at,
        buildingName: row.building_name,

        category: row.category,
        standardTypeNumber: row.standard_type_number ?? row.standardTypeNumber ?? row.standard_type_number,
        standardTypeName: row.standard_type_name ?? row.standardTypeName ?? row.standard_type_name,
        classification: row.classification,
        detailClassification: row.description,

        guid: row.guid,
        gui: row.gui,

        wmCode: row.wm_code,
        gauge: row.gauge,
        description: row.description,
        spec: row.spec,
        addSpec: row.add_spec,

        formula: row.formula,
        substitutedFormula: row.substituted_formula,
        result: row.result,
        resultLog: row.result_log,
        unit: row.unit,
      })),
  [rows]);

  const options = useMemo(() => {
    const uniq = (key) =>
      Array.from(
        new Set(normalizedRows.map((r) => normalizeKey(r[key])).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
    return {
      buildingName: uniq('buildingName'),
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
      if (buildingName && normalizeKey(row.buildingName) !== buildingName) return false;
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
        row.gui,
        row.guid,
        row.wmCode,
        row.description,
        row.spec,
        row.addSpec,
        row.formula,
        row.substitutedFormula,
        row.resultLog,
      ]
        .map((v) => safeText(v).toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [buildingName, filters, normalizedRows, searchText]);

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
          <span style={{ color: '#6b7280' }}>{importing ? 'Importing…' : 'Load JSON'}</span>
          <input type="file" accept="application/json" onChange={handleFileChange} disabled={!apiBaseUrl || importing} />
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
        <select value={buildingName} onChange={(e) => setBuildingName(e.target.value)}>
          <option value="">건물(전체)</option>
          {options.buildingName.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
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
                'Add Spec.',
                '수식',
                '대입수식',
                '산출결과',
                '산출로그',
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
                <td style={{ padding: '6px 8px', minWidth: 160 }}>{safeText(row.addSpec) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 200 }}>{safeText(row.formula) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 220 }}>{safeText(row.substitutedFormula) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{row.result ?? '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 280 }}>{safeText(row.resultLog) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.unit) || '—'}</td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={17} style={{ padding: 14, color: '#6b7280' }}>
                  데이터가 없습니다. 상단의 Load JSON으로 Import 하거나, 기존 저장 데이터를 확인하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

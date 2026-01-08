import React, { useCallback, useEffect, useMemo, useState } from 'react';

const safeText = (value) => (value == null ? '' : String(value));
const normalizeKey = (value) => safeText(value).trim();

const extractBuildingNameFromJson = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const info = payload.project_info;
  if (!info || typeof info !== 'object') return '';
  return safeText(info['building name'] ?? info.building_name ?? info.buildingName).trim();
};

export default function ProjectQtyReportByMember({ apiBaseUrl }) {
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [buildings, setBuildings] = useState([]);
  const [revKeys, setRevKeys] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedRevKey, setSelectedRevKey] = useState('');

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    standardTypeNumber: '',
    standardTypeName: '',
    classification: '',
    description: '',
  });

  const fetchBuildings = useCallback(async () => {
    if (!apiBaseUrl) return;
    const res = await fetch(`${apiBaseUrl}/calc-result/buildings`);
    if (!res.ok) return;
    const data = await res.json().catch(() => []);
    setBuildings(Array.isArray(data) ? data : []);
  }, [apiBaseUrl]);

  const fetchRevKeys = useCallback(async (buildingName) => {
    if (!apiBaseUrl) return [];
    const qs = buildingName ? `?building_name=${encodeURIComponent(buildingName)}` : '';
    const res = await fetch(`${apiBaseUrl}/calc-result/rev-keys${qs}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : [];
    setRevKeys(list);
    return list;
  }, [apiBaseUrl]);

  const fetchRows = useCallback(async ({ buildingName, revKey } = {}) => {
    if (!apiBaseUrl) return;
    const params = new URLSearchParams();
    if (buildingName) params.set('building_name', buildingName);
    if (revKey) params.set('rev_key', revKey);
    params.set('limit', '20000');

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/calc-result?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || 'calc_result 조회 실패');
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setLoadError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    fetchRevKeys(selectedBuilding);
  }, [fetchRevKeys, selectedBuilding]);

  useEffect(() => {
    fetchRows({ buildingName: selectedBuilding || '', revKey: selectedRevKey || '' });
  }, [fetchRows, selectedBuilding, selectedRevKey]);

  const options = useMemo(() => {
    const uniq = (key) => Array.from(new Set(rows.map((r) => normalizeKey(r?.[key])).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      category: uniq('category'),
      standardTypeNumber: uniq('standard_type_number'),
      standardTypeName: uniq('standard_type_name'),
      classification: uniq('classification'),
      description: uniq('description'),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.category && normalizeKey(row?.category) !== filters.category) return false;
      if (filters.standardTypeNumber && normalizeKey(row?.standard_type_number) !== filters.standardTypeNumber) return false;
      if (filters.standardTypeName && normalizeKey(row?.standard_type_name) !== filters.standardTypeName) return false;
      if (filters.classification && normalizeKey(row?.classification) !== filters.classification) return false;
      if (filters.description && normalizeKey(row?.description) !== filters.description) return false;

      if (!needle) return true;
      const haystack = [
        row?.rev_key,
        row?.building_name,
        row?.category,
        row?.standard_type_number,
        row?.standard_type_name,
        row?.classification,
        row?.gui,
        row?.guid,
        row?.wm_code,
        row?.description,
        row?.spec,
        row?.add_spec,
        row?.formula,
        row?.substituted_formula,
        row?.result_log,
      ].map((v) => safeText(v).toLowerCase()).join(' ');
      return haystack.includes(needle);
    });
  }, [filters, rows, searchText]);

  const clearFilters = () => {
    setFilters({
      category: '',
      standardTypeNumber: '',
      standardTypeName: '',
      classification: '',
      description: '',
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!apiBaseUrl) {
      setLoadError('프로젝트가 선택되지 않았습니다.');
      return;
    }

    setLoadError(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const nextBuildingName = extractBuildingNameFromJson(payload);

      const existingKeys = await fetchRevKeys(nextBuildingName);
      const existingLabel = existingKeys.length ? `\n(기존 rev_key: ${existingKeys.join(', ')})` : '';
      const input = window.prompt(`rev_key를 입력하세요.\nBuilding: ${nextBuildingName || '—'}${existingLabel}`);
      const revKey = (input ?? '').trim();
      if (!revKey) return;

      let mode = 'append';
      if (existingKeys.includes(revKey)) {
        const ok = window.confirm(`rev_key '${revKey}'가 이미 있습니다.\n해당 Building+rev_key 데이터를 삭제하고 덮어쓸까요?`);
        if (!ok) {
          window.alert('덮어쓰지 않으려면 새 rev_key를 입력해 주세요.');
          return;
        }
        mode = 'overwrite';
      } else {
        const ok = window.confirm(`새 rev_key '${revKey}'로 추가할까요?`);
        if (!ok) return;
        mode = 'append';
      }

      setLoading(true);
      const form = new FormData();
      form.append('rev_key', revKey);
      form.append('mode', mode);
      form.append('file', file);

      const res = await fetch(`${apiBaseUrl}/calc-result/import-json`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || 'Import 실패');
      }

      await fetchBuildings();
      setSelectedBuilding(nextBuildingName || '');
      setSelectedRevKey(revKey);
      await fetchRevKeys(nextBuildingName);
      await fetchRows({ buildingName: nextBuildingName || '', revKey });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'JSON을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Qty Report by Member</div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: '#6b7280' }}>Load JSON</span>
          <input type="file" accept="application/json" onChange={handleFileChange} disabled={!apiBaseUrl || loading} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedBuilding} onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedRevKey(''); }}>
          <option value="">건물(전체)</option>
          {buildings.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={selectedRevKey} onChange={(e) => setSelectedRevKey(e.target.value)}>
          <option value="">rev_key(전체)</option>
          {revKeys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>

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
          {loading ? 'Loading…' : `Rows: ${filteredRows.length}`}
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
        <select value={filters.description} onChange={(e) => setFilters((p) => ({ ...p, description: e.target.value }))}>
          <option value="">상세분류(전체)</option>
          {options.description.map((v) => (
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

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          scrollbarGutter: 'stable',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {[
                '#',
                'rev_key',
                '카테고리',
                '표준타입 번호',
                '표준타입 이름',
                '분류',
                'GUI',
                '상세분류(Description)',
                'wm_code',
                'gauge',
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
              <tr key={row.id ?? `${row.wm_code}-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{i + 1}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.rev_key) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.category) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.standard_type_number) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.standard_type_name) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.classification) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.gui) || safeText(row.guid) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.description) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.wm_code) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.gauge) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 180 }}>{safeText(row.spec) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 180 }}>{safeText(row.add_spec) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 220 }}>{safeText(row.formula) || '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 240 }}>{safeText(row.substituted_formula) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{row.result ?? '—'}</td>
                <td style={{ padding: '6px 8px', minWidth: 320 }}>{safeText(row.result_log) || '—'}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{safeText(row.unit) || '—'}</td>
              </tr>
            ))}
            {!filteredRows.length && !loading && (
              <tr>
                <td colSpan={17} style={{ padding: 14, color: '#6b7280' }}>
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

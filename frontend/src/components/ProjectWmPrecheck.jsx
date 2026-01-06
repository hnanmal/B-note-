import React, { useCallback, useEffect, useMemo, useState } from 'react';

const handleResponse = async (response) => {
  if (response.ok) return response.json();
  const payload = await response.json().catch(() => null);
  const message = payload?.detail || payload?.message || '요청 처리 중 오류가 발생했습니다.';
  throw new Error(message);
};

const matchesMatcherFilterRules = (workMaster) => {
  const newOld = (workMaster?.new_old_code || '').toLowerCase();
  if (newOld === 'old') return false;

  const code = workMaster?.work_master_code || '';
  if (code.startsWith('S')) {
    return (workMaster?.cat_mid_code || '') === 'AA';
  }
  if (code.startsWith('F')) {
    return (workMaster?.cat_large_code || '') === 'F01';
  }
  return true;
};

const sortWorkMastersByCodeGauge = (a, b) => {
  const baseA = (a?.work_master_code || '').trim().toUpperCase();
  const baseB = (b?.work_master_code || '').trim().toUpperCase();
  if (baseA && baseB && baseA !== baseB) return baseA.localeCompare(baseB);
  if (baseA && !baseB) return -1;
  if (!baseA && baseB) return 1;

  const gaugeA = (a?.gauge || '').trim().toUpperCase();
  const gaugeB = (b?.gauge || '').trim().toUpperCase();
  if (!gaugeA && gaugeB) return -1;
  if (gaugeA && !gaugeB) return 1;
  return gaugeA.localeCompare(gaugeB);
};

export default function ProjectWmPrecheck({ apiBaseUrl }) {
  const [workMasters, setWorkMasters] = useState([]);
  const [useMap, setUseMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!apiBaseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const [wmData, precheckData] = await Promise.all([
        fetch(`${apiBaseUrl}/work-masters/`).then(handleResponse),
        fetch(`${apiBaseUrl}/work-masters/precheck`).then(handleResponse),
      ]);

      const list = Array.isArray(wmData) ? wmData : [];
      setWorkMasters(list);

      const nextMap = {};
      (Array.isArray(precheckData) ? precheckData : []).forEach((row) => {
        const id = Number(row?.work_master_id);
        if (!Number.isFinite(id)) return;
        nextMap[id] = Boolean(row?.use_yn);
      });
      setUseMap(nextMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WM pre-check 데이터를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredWorkMasters = useMemo(() => {
    return workMasters.filter(matchesMatcherFilterRules).sort(sortWorkMastersByCodeGauge);
  }, [workMasters]);

  const isChecked = useCallback(
    (workMasterId) => {
      if (Object.prototype.hasOwnProperty.call(useMap, workMasterId)) {
        return Boolean(useMap[workMasterId]);
      }
      return true;
    },
    [useMap]
  );

  const toggleUse = useCallback(
    async (workMasterId) => {
      if (!apiBaseUrl) return;
      if (!workMasterId) return;

      const previous = isChecked(workMasterId);
      const next = !previous;

      setUseMap((prevMap) => ({ ...prevMap, [workMasterId]: next }));
      setSavingId(workMasterId);
      setError(null);

      try {
        await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/precheck`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ use_yn: next }),
        }).then(handleResponse);
      } catch (err) {
        setUseMap((prevMap) => ({ ...prevMap, [workMasterId]: previous }));
        const message = err instanceof Error ? err.message : '저장하지 못했습니다.';
        setError(message);
      } finally {
        setSavingId(null);
      }
    },
    [apiBaseUrl, isChecked]
  );

  const columns = useMemo(
    () => [
      { key: 'use', label: 'Use' },
      { key: 'work_master_code', label: 'WM Code' },
      { key: 'gauge', label: 'Gauge' },
      { key: 'discipline', label: 'Discipline' },
      { key: 'cat_large_code', label: 'Large Code' },
      { key: 'cat_large_desc', label: 'Large Desc' },
      { key: 'cat_mid_code', label: 'Mid Code' },
      { key: 'cat_mid_desc', label: 'Mid Desc' },
      { key: 'cat_small_code', label: 'Small Code' },
      { key: 'cat_small_desc', label: 'Small Desc' },
      { key: 'attr1_code', label: 'Attr1 Code' },
      { key: 'attr1_spec', label: 'Attr1 Spec' },
      { key: 'attr2_code', label: 'Attr2 Code' },
      { key: 'attr2_spec', label: 'Attr2 Spec' },
      { key: 'attr3_code', label: 'Attr3 Code' },
      { key: 'attr3_spec', label: 'Attr3 Spec' },
      { key: 'attr4_code', label: 'Attr4 Code' },
      { key: 'attr4_spec', label: 'Attr4 Spec' },
      { key: 'attr5_code', label: 'Attr5 Code' },
      { key: 'attr5_spec', label: 'Attr5 Spec' },
      { key: 'attr6_code', label: 'Attr6 Code' },
      { key: 'attr6_spec', label: 'Attr6 Spec' },
      { key: 'uom1', label: 'UOM1' },
      { key: 'uom2', label: 'UOM2' },
      { key: 'work_group_code', label: 'Group Code' },
      { key: 'new_old_code', label: 'New/Old' },
      { key: 'add_spec', label: 'Add Spec' },
    ],
    []
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>WM pre-check</h2>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Matching 위젯 필터 기준으로 전체 WorkMaster를 보여주고, Use 체크를 프로젝트 DB에 저장합니다.
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          disabled={loading}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5f5',
            background: loading ? '#e5e7eb' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 10, padding: '8px 10px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredWorkMasters.map((wm) => {
              const wmId = wm?.id;
              const checked = isChecked(wmId);
              const saving = savingId === wmId;
              return (
                <tr key={wmId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: saving ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggleUse(wmId)}
                      />
                      {saving ? <span style={{ fontSize: 11, color: '#6b7280' }}>Saving...</span> : null}
                    </label>
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}>{wm?.work_master_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{(wm?.gauge ?? '').toString().trim().toUpperCase()}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.discipline ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_large_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_large_desc ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_mid_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_mid_desc ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_small_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.cat_small_desc ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr1_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr1_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr2_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr2_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr3_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr3_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr4_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr4_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr5_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr5_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr6_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.attr6_spec ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.uom1 ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.uom2 ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.work_group_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.new_old_code ?? ''}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{wm?.add_spec ?? ''}</td>
                </tr>
              );
            })}

            {!loading && filteredWorkMasters.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                  표시할 WorkMaster가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

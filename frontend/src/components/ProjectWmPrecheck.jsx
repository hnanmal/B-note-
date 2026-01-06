import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const formatWorkMasterSummary = (wm) => {
  const parts = [];
  const add = (label, value) => {
    const v = (value ?? '').toString().trim();
    if (!v) return;
    parts.push(`${label}=${v}`);
  };

  add('Discipline', wm?.discipline);
  add('Large', [wm?.cat_large_code, wm?.cat_large_desc].filter(Boolean).join(' '));
  add('Mid', [wm?.cat_mid_code, wm?.cat_mid_desc].filter(Boolean).join(' '));
  add('Small', [wm?.cat_small_code, wm?.cat_small_desc].filter(Boolean).join(' '));
  add('Attr1', [wm?.attr1_code, wm?.attr1_spec].filter(Boolean).join(' '));
  add('Attr2', [wm?.attr2_code, wm?.attr2_spec].filter(Boolean).join(' '));
  add('Attr3', [wm?.attr3_code, wm?.attr3_spec].filter(Boolean).join(' '));
  add('Attr4', [wm?.attr4_code, wm?.attr4_spec].filter(Boolean).join(' '));
  add('Attr5', [wm?.attr5_code, wm?.attr5_spec].filter(Boolean).join(' '));
  add('Attr6', [wm?.attr6_code, wm?.attr6_spec].filter(Boolean).join(' '));
  add('Group', wm?.work_group_code);
  add('New/Old', wm?.new_old_code);

  return parts.join(' | ');
};

export default function ProjectWmPrecheck({ apiBaseUrl }) {
  const [workMasters, setWorkMasters] = useState([]);
  const [useMap, setUseMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [gaugeAddingId, setGaugeAddingId] = useState(null);
  const [gaugeRemovingId, setGaugeRemovingId] = useState(null);
  const [error, setError] = useState(null);

  const [editingWorkMasterId, setEditingWorkMasterId] = useState(null);
  const [editingSpec, setEditingSpec] = useState('');
  const [savingSpecWorkMasterId, setSavingSpecWorkMasterId] = useState(null);
  const scrollContainerRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingRestoreRef = useRef(null);
  const specTextareaRef = useRef(null);

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

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    if (loading) return;

    pendingRestoreRef.current = null;
    const container = scrollContainerRef.current;
    if (!container) return;

    const restore = () => {
      if (pending?.workMasterId != null) {
        const node = rowRefs.current.get(pending.workMasterId);
        if (node && node.scrollIntoView) {
          node.scrollIntoView({ block: 'center' });
          return;
        }
      }
      if (typeof pending?.scrollTop === 'number') {
        container.scrollTop = pending.scrollTop;
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [loading, workMasters]);

  const startSpecEdit = useCallback((wm) => {
    const wmId = wm?.id ?? null;
    if (!wmId) return;
    setEditingWorkMasterId(wmId);
    setEditingSpec((wm?.add_spec ?? '').toString());
  }, []);

  const cancelSpecEdit = useCallback(() => {
    setEditingWorkMasterId(null);
    setEditingSpec('');
  }, []);

  useEffect(() => {
    if (editingWorkMasterId == null) return;
    if (savingSpecWorkMasterId != null) return;
    const node = specTextareaRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        node.focus();
        const len = node.value?.length ?? 0;
        node.selectionStart = len;
        node.selectionEnd = len;
      } catch {
        // ignore
      }
    });
  }, [editingWorkMasterId, savingSpecWorkMasterId]);

  const saveSpecEdit = useCallback(async () => {
    if (!apiBaseUrl || !editingWorkMasterId) return;
    const container = scrollContainerRef.current;
    pendingRestoreRef.current = {
      scrollTop: container ? container.scrollTop : 0,
      workMasterId: editingWorkMasterId,
    };
    setSavingSpecWorkMasterId(editingWorkMasterId);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/work-masters/${editingWorkMasterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_spec: editingSpec }),
      }).then(handleResponse);
      setEditingWorkMasterId(null);
      setEditingSpec('');
      await fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spec을 저장하지 못했습니다.';
      setError(message);
    } finally {
      setSavingSpecWorkMasterId(null);
    }
  }, [apiBaseUrl, editingSpec, editingWorkMasterId, fetchAll]);

  const filteredWorkMasters = useMemo(() => {
    return workMasters.filter(matchesMatcherFilterRules).sort(sortWorkMastersByCodeGauge);
  }, [workMasters]);

  const isChecked = useCallback(
    (workMasterId) => {
      if (Object.prototype.hasOwnProperty.call(useMap, workMasterId)) {
        return Boolean(useMap[workMasterId]);
      }
      return false;
    },
    [useMap]
  );

  const handleAddGauge = useCallback(async (workMasterId) => {
    if (!apiBaseUrl) return;
    if (!workMasterId) return;
    if (gaugeAddingId != null || gaugeRemovingId != null) return;

    setGaugeAddingId(workMasterId);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/add-gauge`, {
        method: 'POST',
      }).then(handleResponse);
      await fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : '게이지 항목을 생성할 수 없습니다.';
      setError(message);
    } finally {
      setGaugeAddingId(null);
    }
  }, [apiBaseUrl, fetchAll, gaugeAddingId, gaugeRemovingId]);

  const handleRemoveGauge = useCallback(async (workMasterId) => {
    if (!apiBaseUrl) return;
    if (!workMasterId) return;
    if (gaugeAddingId != null || gaugeRemovingId != null) return;

    setGaugeRemovingId(workMasterId);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/remove-gauge`, {
        method: 'POST',
      }).then(handleResponse);
      await fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : '게이지를 삭제할 수 없습니다.';
      setError(message);
    } finally {
      setGaugeRemovingId(null);
    }
  }, [apiBaseUrl, fetchAll, gaugeAddingId, gaugeRemovingId]);

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
      { key: 'wm_code', label: 'WM Code' },
      { key: 'gauge', label: 'Gauge' },
      { key: 'unit', label: 'Unit' },
      { key: 'spec', label: 'Spec' },
      { key: 'work_master', label: 'Work Master' },
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

      <div ref={scrollContainerRef} style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
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
              const gaugeValue = (wm?.gauge ?? '').toString().trim().toUpperCase();
              const gaugeAdding = gaugeAddingId === wmId;
              const gaugeRemoving = gaugeRemovingId === wmId;
              const gaugeBusy = gaugeAddingId != null || gaugeRemovingId != null;
              const wmCode = (wm?.work_master_code ?? '').toString().trim();
              const wmTitle = wmCode ? (gaugeValue ? `${wmCode}(${gaugeValue})` : wmCode) : (gaugeValue ? `(${gaugeValue})` : '코드 정보 없음');
              const headline =
                wm?.cat_large_desc || wm?.cat_mid_desc || wm?.cat_small_desc || wmTitle;
              const summary = formatWorkMasterSummary(wm);
              const unitLabel = [wm?.uom1, wm?.uom2].filter(Boolean).join(' / ');
              const specValue = (wm?.add_spec ?? '').toString();
              const isEditingSpec = editingWorkMasterId != null && wmId === editingWorkMasterId;
              return (
                <tr
                  key={wmId}
                  ref={(node) => {
                    if (!wmId) return;
                    if (node) rowRefs.current.set(wmId, node);
                    else rowRefs.current.delete(wmId);
                  }}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
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
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 800, color: '#0f172a' }}>{wmCode}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: '#9333ea' }}>{gaugeValue}</span>
                      <button
                        type="button"
                        onClick={() => handleAddGauge(wmId)}
                        disabled={loading || gaugeBusy}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5f5',
                          background: loading || gaugeBusy ? '#f1f5f9' : '#fff',
                          color: loading || gaugeBusy ? '#94a3b8' : '#0f172a',
                          cursor: loading || gaugeBusy ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {gaugeAdding ? '추가 중...' : '추가'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveGauge(wmId)}
                        disabled={loading || gaugeBusy || !gaugeValue}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #f87171',
                          background: loading || gaugeBusy || !gaugeValue ? '#fee2e2' : '#fff',
                          color: loading || gaugeBusy || !gaugeValue ? '#fca5a5' : '#dc2626',
                          cursor: loading || gaugeBusy || !gaugeValue ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {gaugeRemoving ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{unitLabel || ''}</td>
                  <td style={{ padding: '6px 10px', minWidth: 260, maxWidth: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {isEditingSpec ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <textarea
                          ref={specTextareaRef}
                          value={editingSpec}
                          onChange={(e) => setEditingSpec(e.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            if (event.altKey) {
                              event.preventDefault();
                              const target = event.target;
                              if (!(target instanceof HTMLTextAreaElement)) {
                                setEditingSpec((prev) => `${prev}\n`);
                                return;
                              }
                              const start = target.selectionStart ?? target.value.length;
                              const end = target.selectionEnd ?? target.value.length;
                              const nextValue = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
                              setEditingSpec(nextValue);
                              requestAnimationFrame(() => {
                                try {
                                  target.selectionStart = start + 1;
                                  target.selectionEnd = start + 1;
                                } catch {
                                  // ignore
                                }
                              });
                              return;
                            }
                            event.preventDefault();
                            saveSpecEdit();
                          }}
                          rows={3}
                          style={{
                            flex: 1,
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 11,
                            minWidth: 0,
                            resize: 'vertical',
                            lineHeight: 1.35,
                          }}
                        />
                        <button
                          type="button"
                          onClick={saveSpecEdit}
                          disabled={savingSpecWorkMasterId === editingWorkMasterId}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #2563eb',
                            background: savingSpecWorkMasterId === editingWorkMasterId ? '#93c5fd' : '#2563eb',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: savingSpecWorkMasterId === editingWorkMasterId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelSpecEdit}
                          disabled={savingSpecWorkMasterId === editingWorkMasterId}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #cbd5f5',
                            background: '#fff',
                            color: '#1d4ed8',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: savingSpecWorkMasterId === editingWorkMasterId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startSpecEdit(wm)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          padding: '2px 0',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#0f172a',
                          display: 'block',
                          minHeight: 18,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                        title="Spec 수정"
                      >
                        {specValue ? specValue : (
                          <span style={{ color: '#94a3b8' }}>클릭하여 입력</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', minWidth: 420 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {headline}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#9333ea', marginTop: 2 }}>
                          {wmTitle}
                        </div>
                      </div>
                      {summary && (
                        <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {summary}
                        </div>
                      )}
                    </div>
                  </td>
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const isDebugPrecheckEnabled = () => {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugPrecheck') === '1') return true;
    if (window.localStorage?.getItem('debugPrecheck') === '1') return true;
    return false;
  } catch {
    return false;
  }
};

const DEBUG_PRECHECK_TIMING =
  (typeof import.meta !== 'undefined' ? Boolean(import.meta?.env?.DEV) : false) ||
  isDebugPrecheckEnabled();

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

const getWorkMasterSummaryParts = (wm) => {
  const parts = [];
  const add = (label, value) => {
    const v = (value ?? '').toString().trim();
    if (!v) return;
    parts.push({ label, value: v });
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

  return parts;
};

const shouldBoldWorkMasterLabel = (label) => {
  return label === 'Mid' || label === 'Small' || label === 'Attr1' || label === 'Attr2';
};

const PrecheckRow = React.memo(function PrecheckRow({
  wm,
  apiBaseUrl,
  loading,
  refreshToken,
  initialChecked,
  queueScrollRestore,
  updateWorkMasterLocal,
  addGauge,
  removeGauge,
  setUseInMap,
  deleteUseFromMap,
  insertNewlineAtCaret,
  onError,
  onUseSavingChange,
  rowRefs,
}) {
  const wmId = wm?.id;
  const gaugeValue = (wm?.gauge ?? '').toString().trim().toUpperCase();
  const wmCode = (wm?.work_master_code ?? '').toString().trim();
  const wmTitle = wmCode ? (gaugeValue ? `${wmCode}(${gaugeValue})` : wmCode) : (gaugeValue ? `(${gaugeValue})` : '코드 정보 없음');
  const headline = wm?.cat_large_desc || wm?.cat_mid_desc || wm?.cat_small_desc || wmTitle;
  const summaryParts = getWorkMasterSummaryParts(wm);
  const unitLabel = [wm?.uom1, wm?.uom2].filter(Boolean).join(' / ');
  const specValue = (wm?.add_spec ?? '').toString();

  const [checked, setChecked] = useState(() => Boolean(initialChecked));
  const [savingUse, setSavingUse] = useState(false);
  const [gaugeAdding, setGaugeAdding] = useState(false);
  const [gaugeRemoving, setGaugeRemoving] = useState(false);

  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [editingSpecSeed, setEditingSpecSeed] = useState('');
  const [specEditSession, setSpecEditSession] = useState(0);
  const [savingSpec, setSavingSpec] = useState(false);
  const specTextareaRef = useRef(null);

  useEffect(() => {
    setChecked(Boolean(initialChecked));
  }, [initialChecked, refreshToken]);

  useEffect(() => {
    if (!isEditingSpec) return;
    if (savingSpec) return;
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
  }, [isEditingSpec, savingSpec, specEditSession]);

  const toggleUse = useCallback(async () => {
    if (!apiBaseUrl) return;
    if (!wmId) return;
    if (savingUse) return;

    const previous = checked;
    const next = !previous;
    setChecked(next);
    setSavingUse(true);
    onUseSavingChange?.(1);
    onError?.(null);

    const startedAt = performance.now();
    try {
      setUseInMap?.(wmId, next);
      const response = await fetch(`${apiBaseUrl}/work-masters/${wmId}/precheck`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_yn: next }),
      });
      await handleResponse(response);
      if (DEBUG_PRECHECK_TIMING) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        console.log(`[WM pre-check] precheck PATCH ok (${elapsedMs}ms)`, { wmId, use_yn: next, status: response.status });
      }
    } catch (err) {
      setChecked(previous);
      setUseInMap?.(wmId, previous);
      const message = err instanceof Error ? err.message : '저장하지 못했습니다.';
      onError?.(message);
      if (DEBUG_PRECHECK_TIMING) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        console.log(`[WM pre-check] precheck PATCH failed (${elapsedMs}ms)`, { wmId, use_yn: next, error: message });
      }
    } finally {
      setSavingUse(false);
      onUseSavingChange?.(-1);
    }
  }, [apiBaseUrl, checked, onError, onUseSavingChange, savingUse, setUseInMap, wmId]);

  const startSpecEdit = useCallback(() => {
    if (!wmId) return;
    setIsEditingSpec(true);
    setEditingSpecSeed((wm?.add_spec ?? '').toString());
    setSpecEditSession((s) => s + 1);
    onError?.(null);
  }, [onError, wm, wmId]);

  const cancelSpecEdit = useCallback(() => {
    setIsEditingSpec(false);
    setEditingSpecSeed('');
    onError?.(null);
  }, [onError]);

  const saveSpecEdit = useCallback(async () => {
    if (!apiBaseUrl) return;
    if (!wmId) return;
    if (savingSpec) return;

    const nextSpec = (specTextareaRef.current?.value ?? editingSpecSeed).toString();
    queueScrollRestore?.(wmId);
    setSavingSpec(true);
    onError?.(null);

    try {
      const updated = await fetch(`${apiBaseUrl}/work-masters/${wmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_spec: nextSpec }),
      }).then(handleResponse);

      setIsEditingSpec(false);
      setEditingSpecSeed('');
      updateWorkMasterLocal?.(wmId, { ...(updated || {}), add_spec: (updated?.add_spec ?? nextSpec) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spec을 저장하지 못했습니다.';
      onError?.(message);
    } finally {
      setSavingSpec(false);
    }
  }, [apiBaseUrl, editingSpecSeed, onError, queueScrollRestore, savingSpec, updateWorkMasterLocal, wmId]);

  const handleAddGauge = useCallback(async () => {
    if (!wmId) return;
    if (gaugeAdding || gaugeRemoving) return;
    setGaugeAdding(true);
    onError?.(null);
    try {
      await addGauge?.(wmId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '게이지 항목을 생성할 수 없습니다.';
      onError?.(message);
    } finally {
      setGaugeAdding(false);
    }
  }, [addGauge, gaugeAdding, gaugeRemoving, onError, wmId]);

  const handleRemoveGauge = useCallback(async () => {
    if (!wmId) return;
    if (gaugeAdding || gaugeRemoving) return;
    if (!gaugeValue) return;
    setGaugeRemoving(true);
    onError?.(null);
    try {
      await removeGauge?.(wmId, wmCode);
      deleteUseFromMap?.(wmId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '게이지를 삭제할 수 없습니다.';
      onError?.(message);
    } finally {
      setGaugeRemoving(false);
    }
  }, [deleteUseFromMap, gaugeAdding, gaugeRemoving, gaugeValue, onError, removeGauge, wmCode, wmId]);

  return (
    <tr
      key={wmId}
      ref={(node) => {
        if (!wmId) return;
        if (node) rowRefs.current.set(wmId, node);
        else rowRefs.current.delete(wmId);
      }}
      style={{
        borderBottom: '1px solid #f1f5f9',
        contentVisibility: 'auto',
        containIntrinsicSize: '1px 120px',
        contain: 'layout style paint',
      }}
    >
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: savingUse ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            disabled={savingUse}
            onChange={toggleUse}
          />
        </label>
      </td>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 800, color: '#0f172a' }}>{wmCode}</td>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, color: '#9333ea' }}>{gaugeValue}</span>
          <button
            type="button"
            onClick={handleAddGauge}
            disabled={loading || gaugeAdding || gaugeRemoving}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5f5',
              background: loading || gaugeAdding || gaugeRemoving ? '#f1f5f9' : '#fff',
              color: loading || gaugeAdding || gaugeRemoving ? '#94a3b8' : '#0f172a',
              cursor: loading || gaugeAdding || gaugeRemoving ? 'not-allowed' : 'pointer',
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {gaugeAdding ? '추가 중...' : '추가'}
          </button>
          <button
            type="button"
            onClick={handleRemoveGauge}
            disabled={loading || gaugeAdding || gaugeRemoving || !gaugeValue}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #f87171',
              background: loading || gaugeAdding || gaugeRemoving || !gaugeValue ? '#fee2e2' : '#fff',
              color: loading || gaugeAdding || gaugeRemoving || !gaugeValue ? '#fca5a5' : '#dc2626',
              cursor: loading || gaugeAdding || gaugeRemoving || !gaugeValue ? 'not-allowed' : 'pointer',
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
              key={specEditSession}
              defaultValue={editingSpecSeed}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if (event.altKey) {
                  event.preventDefault();
                  const target = event.target;
                  if (target instanceof HTMLTextAreaElement) insertNewlineAtCaret(target);
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
              disabled={savingSpec}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: savingSpec ? '#93c5fd' : '#2563eb',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: savingSpec ? 'not-allowed' : 'pointer',
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={cancelSpecEdit}
              disabled={savingSpec}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5f5',
                background: '#fff',
                color: '#1d4ed8',
                fontSize: 11,
                fontWeight: 700,
                cursor: savingSpec ? 'not-allowed' : 'pointer',
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startSpecEdit}
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
          {summaryParts.length > 0 && (
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {summaryParts.map((part, index) => (
                <span key={`${part.label}-${index}`}>
                  {index > 0 ? ' | ' : ''}
                  <span>{part.label}=</span>
                  <span
                    style={shouldBoldWorkMasterLabel(part.label)
                      ? { fontWeight: 900, color: '#9333ea', fontSize: 12 }
                      : { fontWeight: 400 }}
                  >
                    {part.value}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function ProjectWmPrecheck({ apiBaseUrl }) {
  const [workMasters, setWorkMasters] = useState([]);
  const useMapRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pendingRenderMeasureRef = useRef(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRafRef = useRef(0);

  const ROW_HEIGHT_ESTIMATE = 120;
  const OVERSCAN = 10;

  const [refreshToken, setRefreshToken] = useState(0);
  const [useSavingCount, setUseSavingCount] = useState(0);
  const scrollContainerRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingRestoreRef = useRef(null);
  const gaugeBusyRef = useRef(false);

  const insertNewlineAtCaret = useCallback((target) => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.value = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
    requestAnimationFrame(() => {
      try {
        target.selectionStart = start + 1;
        target.selectionEnd = start + 1;
      } catch {
        // ignore
      }
    });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!apiBaseUrl) return;
    setLoading(true);
    setError(null);
    const startedAt = DEBUG_PRECHECK_TIMING ? performance.now() : 0;
    try {
      const [wmData, precheckData] = await Promise.all([
        fetch(`${apiBaseUrl}/work-masters/`).then(handleResponse),
        fetch(`${apiBaseUrl}/work-masters/precheck`).then(handleResponse),
      ]);

      if (DEBUG_PRECHECK_TIMING) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        console.log('[WM pre-check] fetchAll ok', {
          elapsedMs,
          workMasters: Array.isArray(wmData) ? wmData.length : 0,
          precheckRows: Array.isArray(precheckData) ? precheckData.length : 0,
        });
      }

      const nextMap = new Map();
      (Array.isArray(precheckData) ? precheckData : []).forEach((row) => {
        const id = Number(row?.work_master_id);
        if (!Number.isFinite(id)) return;
        nextMap.set(id, Boolean(row?.use_yn));
      });
      useMapRef.current = nextMap;

      const list = Array.isArray(wmData) ? wmData : [];
      if (DEBUG_PRECHECK_TIMING) {
        pendingRenderMeasureRef.current = { startedAt: performance.now(), rowCount: list.length };
      }
      setWorkMasters(list);
      setRefreshToken((t) => t + 1);
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
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateViewport = () => {
      setViewportHeight(container.clientHeight || 0);
    };

    const handleScroll = () => {
      if (scrollRafRef.current) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = 0;
        setScrollTop(container.scrollTop || 0);
      });
    };

    updateViewport();
    setScrollTop(container.scrollTop || 0);
    container.addEventListener('scroll', handleScroll, { passive: true });

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateViewport());
      ro.observe(container);
    } else {
      window.addEventListener('resize', updateViewport);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', updateViewport);
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = 0;
      }
    };
  }, []);

  const queueScrollRestore = useCallback((workMasterId) => {
    const container = scrollContainerRef.current;
    pendingRestoreRef.current = {
      scrollTop: container ? container.scrollTop : 0,
      workMasterId,
    };
  }, []);

  const filteredWorkMasters = useMemo(() => {
    if (!DEBUG_PRECHECK_TIMING) {
      return workMasters.filter(matchesMatcherFilterRules).sort(sortWorkMastersByCodeGauge);
    }
    const startedAt = performance.now();
    const result = workMasters.filter(matchesMatcherFilterRules).sort(sortWorkMastersByCodeGauge);
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.log('[WM pre-check] filter/sort', { elapsedMs, total: workMasters.length, filtered: result.length });
    return result;
  }, [workMasters]);

  const filteredIndexById = useMemo(() => {
    const map = new Map();
    filteredWorkMasters.forEach((wm, index) => {
      if (wm?.id != null) map.set(wm.id, index);
    });
    return map;
  }, [filteredWorkMasters]);

  const windowed = useMemo(() => {
    const total = filteredWorkMasters.length;
    if (!total) {
      return { total: 0, start: 0, end: 0, topPad: 0, bottomPad: 0, rows: [] };
    }
    const rowH = ROW_HEIGHT_ESTIMATE;
    const viewH = viewportHeight || 0;
    const st = scrollTop || 0;
    const start = Math.max(0, Math.floor(st / rowH) - OVERSCAN);
    const end = Math.min(total, Math.ceil((st + viewH) / rowH) + OVERSCAN);
    return {
      total,
      start,
      end,
      topPad: start * rowH,
      bottomPad: Math.max(0, (total - end) * rowH),
      rows: filteredWorkMasters.slice(start, end),
    };
  }, [filteredWorkMasters, scrollTop, viewportHeight]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    if (loading) return;

    pendingRestoreRef.current = null;
    const container = scrollContainerRef.current;
    if (!container) return;

    const restore = () => {
      if (pending?.workMasterId != null) {
        const idx = filteredIndexById.get(pending.workMasterId);
        if (idx != null) {
          const target = Math.max(0, idx * ROW_HEIGHT_ESTIMATE - ROW_HEIGHT_ESTIMATE * 2);
          container.scrollTop = target;
          return;
        }
      }
      if (typeof pending?.scrollTop === 'number') {
        container.scrollTop = pending.scrollTop;
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [filteredIndexById, loading, refreshToken, workMasters]);

  useEffect(() => {
    if (!DEBUG_PRECHECK_TIMING) return;
    if (loading) return;
    const pending = pendingRenderMeasureRef.current;
    if (!pending) return;
    pendingRenderMeasureRef.current = null;
    const elapsedMs = Math.round(performance.now() - pending.startedAt);
    console.log('[WM pre-check] render commit', {
      elapsedMs,
      workMasters: pending.rowCount,
      filtered: filteredWorkMasters.length,
    });
  }, [filteredWorkMasters.length, loading, refreshToken]);

  const setUseInMap = useCallback((workMasterId, next) => {
    if (workMasterId == null) return;
    useMapRef.current.set(workMasterId, Boolean(next));
  }, []);

  const deleteUseFromMap = useCallback((workMasterId) => {
    if (workMasterId == null) return;
    useMapRef.current.delete(workMasterId);
  }, []);

  const updateWorkMasterLocal = useCallback((workMasterId, patch) => {
    if (workMasterId == null) return;
    setWorkMasters((prev) => prev.map((wm) => (
      wm?.id === workMasterId ? { ...wm, ...(patch || {}) } : wm
    )));
  }, []);

  const addGauge = useCallback(async (workMasterId) => {
    if (!apiBaseUrl) return;
    if (!workMasterId) return;
    if (gaugeBusyRef.current) throw new Error('다른 게이지 작업이 진행 중입니다.');
    gaugeBusyRef.current = true;
    try {
      const created = await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/add-gauge`, {
        method: 'POST',
      }).then(handleResponse);

      const updatedOriginal = await fetch(`${apiBaseUrl}/work-masters/${workMasterId}`).then(handleResponse);

      if (updatedOriginal?.id) {
        setWorkMasters((prev) => prev.map((wm) => (wm?.id === updatedOriginal.id ? updatedOriginal : wm)));
      }
      if (created?.id) {
        setWorkMasters((prev) => {
          const exists = prev.some((wm) => wm?.id === created.id);
          return exists ? prev : [...prev, created];
        });
      }
    } finally {
      gaugeBusyRef.current = false;
    }
  }, [apiBaseUrl]);

  const removeGauge = useCallback(async (workMasterId, targetCodeRaw) => {
    if (!apiBaseUrl) return;
    if (!workMasterId) return;
    if (gaugeBusyRef.current) throw new Error('다른 게이지 작업이 진행 중입니다.');
    gaugeBusyRef.current = true;
    try {
      const targetCode = (targetCodeRaw ?? '').toString().trim();

      await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/remove-gauge`, {
        method: 'POST',
      }).then(handleResponse);

      setWorkMasters((prev) => prev.filter((wm) => wm?.id !== workMasterId));
      useMapRef.current.delete(workMasterId);

      if (targetCode) {
        const refreshed = await fetch(`${apiBaseUrl}/work-masters/?search=${encodeURIComponent(targetCode)}`).then(handleResponse);
        const refreshedGroup = (Array.isArray(refreshed) ? refreshed : []).filter((wm) => (
          (wm?.work_master_code ?? '').toString().trim() === targetCode
        ));
        setWorkMasters((prev) => {
          const others = prev.filter((wm) => (wm?.work_master_code ?? '').toString().trim() !== targetCode);
          return [...others, ...refreshedGroup];
        });
      }
    } finally {
      gaugeBusyRef.current = false;
    }
  }, [apiBaseUrl]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {useSavingCount > 0 ? (
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
              Saving...
            </span>
          ) : null}
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
            {windowed.topPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ padding: 0, borderBottom: 'none' }}>
                  <div style={{ height: windowed.topPad }} />
                </td>
              </tr>
            )}

            {windowed.rows.map((wm) => {
              const wmId = wm?.id;
              return (
                <PrecheckRow
                  key={wmId}
                  wm={wm}
                  apiBaseUrl={apiBaseUrl}
                  loading={loading}
                  refreshToken={refreshToken}
                  initialChecked={Boolean(wmId != null ? useMapRef.current.get(wmId) : false)}
                  queueScrollRestore={queueScrollRestore}
                  updateWorkMasterLocal={updateWorkMasterLocal}
                  addGauge={addGauge}
                  removeGauge={removeGauge}
                  setUseInMap={setUseInMap}
                  deleteUseFromMap={deleteUseFromMap}
                  insertNewlineAtCaret={insertNewlineAtCaret}
                  onError={setError}
                  onUseSavingChange={(delta) => setUseSavingCount((c) => Math.max(0, c + delta))}
                  rowRefs={rowRefs}
                />
              );
            })}

            {windowed.bottomPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ padding: 0, borderBottom: 'none' }}>
                  <div style={{ height: windowed.bottomPad }} />
                </td>
              </tr>
            )}

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

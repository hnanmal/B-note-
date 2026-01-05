import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const handleResponse = async (response) => {
  if (response.ok) return response.json();
  const payload = await response.json().catch(() => null);
  const message = payload?.detail || payload?.message || '요청 처리 중 오류가 발생했습니다.';
  throw new Error(message);
};

export default function ProjectWmSummary({ apiBaseUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [editingWorkMasterId, setEditingWorkMasterId] = useState(null);
  const [editingSpec, setEditingSpec] = useState('');
  const [savingWorkMasterId, setSavingWorkMasterId] = useState(null);
  const scrollContainerRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingRestoreRef = useRef(null);

  const fetchSummary = useCallback(async () => {
    if (!apiBaseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetch(`${apiBaseUrl}/work-master-selections/summary`).then(handleResponse);
      const resultRows = Array.isArray(data?.rows) ? data.rows : [];
      setRows(resultRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WM Summary를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

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
  }, [loading, rows]);

  const startSpecEdit = useCallback((row) => {
    const wmId = row?.work_master_id ?? null;
    if (!wmId) return;
    setEditingWorkMasterId(wmId);
    setEditingSpec((row?.add_spec ?? '').toString());
  }, []);

  const cancelSpecEdit = useCallback(() => {
    setEditingWorkMasterId(null);
    setEditingSpec('');
  }, []);

  const saveSpecEdit = useCallback(async () => {
    if (!apiBaseUrl || !editingWorkMasterId) return;
    const container = scrollContainerRef.current;
    pendingRestoreRef.current = {
      scrollTop: container ? container.scrollTop : 0,
      workMasterId: editingWorkMasterId,
    };
    setSavingWorkMasterId(editingWorkMasterId);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/work-masters/${editingWorkMasterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_spec: editingSpec }),
      }).then(handleResponse);
      setEditingWorkMasterId(null);
      setEditingSpec('');
      await fetchSummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spec을 저장하지 못했습니다.';
      setError(message);
    } finally {
      setSavingWorkMasterId(null);
    }
  }, [apiBaseUrl, editingSpec, editingWorkMasterId, fetchSummary]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const tokens = [
        row?.work_master_code,
        row?.gauge,
        row?.uom1,
        row?.add_spec,
        row?.standard_item_name,
        row?.standard_item_type,
        row?.standard_item_path,
      ]
        .map((v) => (v ?? '').toString().toLowerCase())
        .join(' | ');
      return tokens.includes(q);
    });
  }, [query, rows]);

  const formatWorkMasterDetails = useCallback((row) => {
    const parts = [];
    const add = (label, value) => {
      const v = (value ?? '').toString().trim();
      if (!v) return;
      parts.push(`${label}=${v}`);
    };

    add('Discipline', row?.discipline);
    add('Large', [row?.cat_large_code, row?.cat_large_desc].filter(Boolean).join(' '));
    add('Mid', [row?.cat_mid_code, row?.cat_mid_desc].filter(Boolean).join(' '));
    add('Small', [row?.cat_small_code, row?.cat_small_desc].filter(Boolean).join(' '));
    add('Attr1', [row?.attr1_code, row?.attr1_spec].filter(Boolean).join(' '));
    add('Attr2', [row?.attr2_code, row?.attr2_spec].filter(Boolean).join(' '));
    add('Attr3', [row?.attr3_code, row?.attr3_spec].filter(Boolean).join(' '));
    add('Attr4', [row?.attr4_code, row?.attr4_spec].filter(Boolean).join(' '));
    add('Attr5', [row?.attr5_code, row?.attr5_spec].filter(Boolean).join(' '));
    add('Attr6', [row?.attr6_code, row?.attr6_spec].filter(Boolean).join(' '));
    add('UOM1', row?.uom1);
    add('UOM2', row?.uom2);
    add('Group', row?.work_group_code);
    add('New/Old', row?.new_old_code);

    return parts.join(' | ');
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>WM Summary Sheet</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            프로젝트 DB의 <code>standard_item_work_master_select</code> 선택 결과를 표시합니다.
          </div>
          {apiBaseUrl ? <div style={{ fontSize: 11, color: '#94a3b8' }}>API: {apiBaseUrl}</div> : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 (코드/Spec/경로 등)"
            style={{
              height: 34,
              borderRadius: 10,
              border: '1px solid #d1d5db',
              padding: '0 12px',
              fontSize: 12,
              minWidth: 240,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid #2563eb',
              background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: '#fff',
          borderRadius: 16,
          padding: 12,
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {error ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div> : null}

        <div style={{ fontSize: 12, color: '#475569' }}>
          총 <b>{filteredRows.length}</b>건
        </div>

        <div ref={scrollContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 160px 64px 70px 240px 1fr 200px 1fr',
              gap: 0,
              position: 'sticky',
              top: 0,
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              zIndex: 1,
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            {['No', 'WM Code', 'Gauge', 'Unit', 'Spec', 'Work Master', 'Type', 'Item Path'].map((label) => (
              <div key={label} style={{ padding: '8px 10px', borderRight: '1px solid #e5e7eb' }}>
                {label}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 14, fontSize: 12, color: '#475467' }}>데이터를 불러오는 중입니다...</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: '#475467' }}>표시할 데이터가 없습니다.</div>
          ) : (
            filteredRows.map((row, idx) => {
              const wmCode = row?.work_master_code ?? '';
              const gauge = row?.gauge ?? '';
              const unit = row?.uom1 ?? '';
              const spec = row?.add_spec ?? '';
              const workMasterText = `${wmCode}${gauge ? ` | ${gauge}` : ''}${formatWorkMasterDetails(row) ? ` | ${formatWorkMasterDetails(row)}` : ''}`;
              const type = `${row?.standard_item_type ?? ''}`;
              const itemPath = row?.standard_item_path ?? '';
              const isEditingSpec = editingWorkMasterId != null && row?.work_master_id === editingWorkMasterId;
              return (
                <div
                  key={`${row?.standard_item_id ?? 'std'}-${row?.work_master_id ?? 'wm'}-${idx}`}
                  ref={(node) => {
                    const key = row?.work_master_id;
                    if (!key) return;
                    if (node) rowRefs.current.set(key, node);
                    else rowRefs.current.delete(key);
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 160px 64px 70px 240px 1fr 200px 1fr',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 11,
                    color: '#0f172a',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{idx + 1}</div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', fontWeight: 700 }}>{wmCode}</div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{gauge}</div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{unit}</div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
                    {isEditingSpec ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={editingSpec}
                          onChange={(e) => setEditingSpec(e.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            if (event.altKey) {
                              event.preventDefault();
                              const target = event.target;
                              if (!(target instanceof HTMLInputElement)) {
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
                          style={{
                            flex: 1,
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontSize: 11,
                            minWidth: 0,
                          }}
                        />
                        <button
                          type="button"
                          onClick={saveSpecEdit}
                          disabled={savingWorkMasterId === editingWorkMasterId}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #2563eb',
                            background: savingWorkMasterId === editingWorkMasterId ? '#93c5fd' : '#2563eb',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: savingWorkMasterId === editingWorkMasterId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelSpecEdit}
                          disabled={savingWorkMasterId === editingWorkMasterId}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #cbd5f5',
                            background: '#fff',
                            color: '#1d4ed8',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: savingWorkMasterId === editingWorkMasterId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startSpecEdit(row)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 11,
                          color: '#0f172a',
                        }}
                        title="Spec 수정"
                      >
                        {spec}
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{workMasterText}</div>
                  <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{type}</div>
                  <div style={{ padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{itemPath}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

  import React, { useCallback, useEffect, useMemo, useState } from 'react';
  import { API_BASE_URL } from '../apiConfig';

  const emptyEntry = {
    classification: '',
    abbreviation: '',
    description: '',
    input_value: '',
    unit: '',
    remark: '',
  };

  const statusStyle = (status) => {
    if (!status) return {};
    return status.type === 'error'
      ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
      : { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
  };

  const buildTree = (entries) => {
    const map = new Map();
    entries.forEach((entry) => {
      const classification = entry.classification?.trim() || '기타';
      if (!map.has(classification)) {
        map.set(classification, []);
      }
      map.get(classification).push(entry);
    });
    return Array.from(map.entries()).map(([classification, items]) => ({
      classification,
      items: items.sort((a, b) => (a.abbreviation || '').localeCompare(b.abbreviation || '')),
    }));
  };

  const handleResponse = async (response) => {
    if (response.ok) {
      return response.json();
    }
    const payload = await response.json().catch(() => null);
    const message = payload?.detail || payload?.message || '요청 처리 중 오류가 발생했습니다.';
    throw new Error(message);
  };

  export default function CommonInputManager() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [operationPending, setOperationPending] = useState(false);
    const [form, setForm] = useState(emptyEntry);
    const [editingId, setEditingId] = useState(null);
    const [editingValues, setEditingValues] = useState(emptyEntry);
    const [collapsed, setCollapsed] = useState(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);

    const INLINE_FIELD_HEIGHT = 40;
    const inlineFieldStyle = {
      width: '100%',
      height: INLINE_FIELD_HEIGHT,
      padding: '0 10px',
      borderRadius: 6,
      border: '1px solid #d1d5db',
      boxSizing: 'border-box',
      fontSize: 14,
      background: '#fff',
    };

    const textareaFieldStyle = {
      ...inlineFieldStyle,
      resize: 'none',
    };

    const inlineRowStyle = {
      display: 'flex',
      gap: 12,
      flexWrap: 'nowrap',
      alignItems: 'flex-start',
      padding: '6px 0',
      overflowX: 'auto',
    };

    const fetchEntries = useCallback(async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/common-input/`);
        const data = await handleResponse(response);
        setEntries(data);
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchEntries();
    }, [fetchEntries]);

    const toggleCategory = (category) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        return next;
      });
    };

    const startEdit = (entry) => {
      setEditingId(entry.id);
      setEditingValues({
        classification: entry.classification || '',
        abbreviation: entry.abbreviation || '',
        description: entry.description || '',
        input_value: entry.input_value || '',
        unit: entry.unit || '',
        remark: entry.remark || '',
      });
      setStatus(null);
      setEditModalOpen(true);
    };

    const cancelEdit = () => {
      setEditingId(null);
      setEditingValues(emptyEntry);
      setEditModalOpen(false);
    };

    const handleCreate = async () => {
      if (!form.classification.trim()) {
        setStatus({ type: 'error', message: '분류명은 필수입니다.' });
        return;
      }
      setOperationPending(true);
      try {
        const response = await fetch(`${API_BASE_URL}/common-input/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        await handleResponse(response);
        setForm(emptyEntry);
        setStatus({ type: 'success', message: '공통 입력 항목이 등록되었습니다.' });
        await fetchEntries();
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      } finally {
        setOperationPending(false);
      }
    };

    const handleUpdate = async () => {
      if (!editingId) return;
      if (!editingValues.classification.trim()) {
        setStatus({ type: 'error', message: '분류명은 필수입니다.' });
        return;
      }
      setOperationPending(true);
      try {
        const response = await fetch(`${API_BASE_URL}/common-input/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingValues),
        });
        await handleResponse(response);
        setStatus({ type: 'success', message: '항목이 수정되었습니다.' });
        cancelEdit();
        await fetchEntries();
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      } finally {
        setOperationPending(false);
      }
    };

    const handleDelete = async (id) => {
      if (!window.confirm('정말 삭제하시겠습니까?')) return;
      setOperationPending(true);
      try {
        const response = await fetch(`${API_BASE_URL}/common-input/${id}`, {
          method: 'DELETE',
        });
        await handleResponse(response);
        setStatus({ type: 'success', message: '항목이 삭제되었습니다.' });
        await fetchEntries();
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      } finally {
        setOperationPending(false);
      }
    };

    const tree = useMemo(() => buildTree(entries), [entries]);
    const totalCount = entries.length;
    const classificationDatalist = useMemo(
      () => Array.from(new Set(entries.map((entry) => entry.classification?.trim() || ''))).filter(Boolean),
      [entries],
    );

    const cardGridStyle = {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(180px, 1fr))',
      gap: 6,
    };

    const cardStyle = {
      borderRadius: 14,
      background: '#fff',
      padding: 14,
      minHeight: 80,
      boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    };

    const modalOverlayStyle = {
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 60,
    };

    const modalContentStyle = {
      ...cardStyle,
      minWidth: 480,
      maxWidth: 'calc(100% - 48px)',
      width: 'min(900px, 100%)',
      boxShadow: '0 16px 40px rgba(15,23,42,0.25)',
    };

    const modalFieldRowStyle = {
      ...inlineRowStyle,
      padding: '0',
      marginBottom: 14,
    };

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={inlineRowStyle}>
          <div style={{ flex: '0 0 160px', minWidth: 140 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>분류</label>
            <input
              list="classification-suggestions"
              value={form.classification}
              onChange={(e) => setForm((prev) => ({ ...prev, classification: e.target.value }))}
              placeholder="예: 구조"
              style={inlineFieldStyle}
            />
            <datalist id="classification-suggestions">
              {classificationDatalist.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div style={{ flex: '0 0 140px', minWidth: 130 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>Abbreviation</label>
            <input
              value={form.abbreviation}
              onChange={(e) => setForm((prev) => ({ ...prev, abbreviation: e.target.value }))}
              placeholder="예: STR"
              style={inlineFieldStyle}
            />
          </div>
          <div style={{ flex: '0 0 220px', minWidth: 180 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="설명"
              style={{ ...textareaFieldStyle, height: INLINE_FIELD_HEIGHT }}
            />
          </div>
          <div style={{ flex: '0 0 150px', minWidth: 130 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>Input</label>
            <input
              value={form.input_value}
              onChange={(e) => setForm((prev) => ({ ...prev, input_value: e.target.value }))}
              placeholder="입력값"
              style={inlineFieldStyle}
            />
          </div>
          <div style={{ flex: '0 0 130px', minWidth: 110 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="차원"
              style={inlineFieldStyle}
            />
          </div>
          <div style={{ flex: '0 0 220px', minWidth: 180 }}>
            <label style={{ fontSize: 12, color: '#475467' }}>Remark</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
              placeholder="비고"
              style={{ ...textareaFieldStyle, height: INLINE_FIELD_HEIGHT }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={operationPending}
            style={{
              padding: '0 20px',
              height: INLINE_FIELD_HEIGHT,
              borderRadius: 8,
              border: 'none',
              background: operationPending ? '#93c5fd' : '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: operationPending ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            등록
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#475467' }}>
            총 {totalCount}개의 항목 · {loading ? '데이터 로딩 중...' : '완료'}
          </span>
          {status && <span style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, ...statusStyle(status) }}>{status.message}</span>}
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: 12,
            background: '#f8fafc',
          }}
        >
          {tree.length === 0 && <div style={{ color: '#6b7280' }}>등록된 항목이 없습니다.</div>}
          {tree.map(({ classification, items }) => (
            <div key={classification} style={{ marginBottom: 16 }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(classification)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: 'none',
                      background: collapsed.has(classification) ? '#e0e7ff' : '#eef2ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {collapsed.has(classification) ? '＋' : '－'}
                  </button>
                  <div>
                    <strong style={{ fontSize: 16 }}>{classification}</strong>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{items.length}개</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#475467' }}>카드형 목록</span>
              </div>
              {!collapsed.has(classification) && (
                <div style={{ marginTop: 12 }}>
                  <div style={cardGridStyle}>
                    {items.map((entry) => (
                      <div key={entry.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{entry.abbreviation || '무명'}</div>
                            <div style={{ fontSize: 12, color: '#475467' }}>{entry.description || '설명이 없습니다.'}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 6,
                                border: '1px solid #cbd5f5',
                                background: '#fff',
                                fontSize: 12,
                              }}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              disabled={operationPending}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                                background: '#fee2e2',
                                color: '#991b1b',
                                cursor: operationPending ? 'not-allowed' : 'pointer',
                                fontSize: 12,
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475467' }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Input</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1d4ed8' }}>{entry.input_value || '-'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Unit</div>
                            <div>{entry.unit || '-'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Remark</div>
                            <div>{entry.remark || '-'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      {editModalOpen && (
        <div style={modalOverlayStyle} onClick={(e) => void (e.target === e.currentTarget && cancelEdit())}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 18, color: '#0f172a' }}>항목 수정</strong>
              <button
                type="button"
                onClick={cancelEdit}
                style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={modalFieldRowStyle}>
              <div style={{ flex: '0 0 160px', minWidth: 140 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>분류</label>
                <input
                  value={editingValues.classification}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, classification: e.target.value }))}
                  placeholder="예: 구조"
                  style={inlineFieldStyle}
                />
              </div>
              <div style={{ flex: '0 0 140px', minWidth: 130 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>Abbreviation</label>
                <input
                  value={editingValues.abbreviation}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, abbreviation: e.target.value }))}
                  placeholder="예: STR"
                  style={inlineFieldStyle}
                />
              </div>
              <div style={{ flex: '0 0 220px', minWidth: 180 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>Description</label>
                <textarea
                  value={editingValues.description}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="설명"
                  style={{ ...textareaFieldStyle, height: INLINE_FIELD_HEIGHT }}
                />
              </div>
              <div style={{ flex: '0 0 150px', minWidth: 130 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>Input</label>
                <input
                  value={editingValues.input_value}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, input_value: e.target.value }))}
                  placeholder="입력값"
                  style={inlineFieldStyle}
                />
              </div>
              <div style={{ flex: '0 0 130px', minWidth: 110 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>Unit</label>
                <input
                  value={editingValues.unit}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="차원"
                  style={inlineFieldStyle}
                />
              </div>
              <div style={{ flex: '0 0 220px', minWidth: 180 }}>
                <label style={{ fontSize: 12, color: '#475467' }}>Remark</label>
                <textarea
                  value={editingValues.remark}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, remark: e.target.value }))}
                  placeholder="비고"
                  style={{ ...textareaFieldStyle, height: INLINE_FIELD_HEIGHT }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={operationPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: operationPending ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #cbd5f5',
                  background: '#fff',
                  color: '#475467',
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

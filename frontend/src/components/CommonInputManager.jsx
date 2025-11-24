import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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
  const [operationPending, setOperationPending] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyEntry);
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState(emptyEntry);
  const [collapsed, setCollapsed] = useState(new Set());

  const INLINE_FIELD_HEIGHT = 40;
  const inlineFieldStyle = {
    width: '100%',
    padding: 8,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    boxSizing: 'border-box',
    height: INLINE_FIELD_HEIGHT,
  };
  const textareaFieldStyle = {
    ...inlineFieldStyle,
    minHeight: INLINE_FIELD_HEIGHT,
    resize: 'vertical',
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValues(emptyEntry);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 12,
          alignItems: 'stretch',
          overflowX: 'auto',
          padding: '6px 0',
        }}
      >
        <div style={{ flex: '0 0 150px', minWidth: 120, padding: '4px 0' }}>
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
        <div style={{ flex: '0 0 130px', minWidth: 110, padding: '4px 0' }}>
          <label style={{ fontSize: 12, color: '#475467' }}>Abbreviation</label>
          <input
            value={form.abbreviation}
            onChange={(e) => setForm((prev) => ({ ...prev, abbreviation: e.target.value }))}
            placeholder="예: STR"
            style={inlineFieldStyle}
          />
        </div>
        <div style={{ flex: '0 0 220px', minWidth: 160, padding: '4px 0' }}>
          <label style={{ fontSize: 12, color: '#475467' }}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="설명"
            style={textareaFieldStyle}
          />
        </div>
        <div style={{ flex: '0 0 150px', minWidth: 120, padding: '4px 0' }}>
          <label style={{ fontSize: 12, color: '#475467' }}>Input</label>
          <input
            value={form.input_value}
            onChange={(e) => setForm((prev) => ({ ...prev, input_value: e.target.value }))}
            placeholder="입력값"
            style={inlineFieldStyle}
          />
        </div>
        <div style={{ flex: '0 0 130px', minWidth: 100, padding: '4px 0' }}>
          <label style={{ fontSize: 12, color: '#475467' }}>Unit</label>
          <input
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="차원"
            style={inlineFieldStyle}
          />
        </div>
        <div style={{ flex: '0 0 220px', minWidth: 160, padding: '4px 0' }}>
          <label style={{ fontSize: 12, color: '#475467' }}>Remark</label>
          <textarea
            value={form.remark}
            onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            placeholder="비고"
            style={textareaFieldStyle}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={operationPending}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: operationPending ? '#c7d2fe' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: operationPending ? 'not-allowed' : 'pointer',
            height: 40,
            alignSelf: 'center',
            flex: '0 0 auto',
          }}
        >
          등록
        </button>
      </div>
      <div style={{ gap: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#475467' }}>총 {totalCount}개의 항목 · {loading ? '데이터 로딩 중...' : '완료'}</div>
        {status && <div style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, ...statusStyle(status) }}>{status.message}</div>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
        {tree.length === 0 && <div style={{ color: '#6b7280' }}>등록된 항목이 없습니다.</div>}
        {tree.map(({ classification, items }) => (
          <div key={classification} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: 'transparent',
                  }}
                >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(classification)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 999,
                          border: 'none',
                          background: collapsed.has(classification) ? '#e0e7ff' : '#eef2ff',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          fontWeight: 700,
                          boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {collapsed.has(classification) ? '＋' : '−'}
                      </button>
                <div>
                  <strong style={{ fontSize: 16 }}>{classification}</strong>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{items.length}개</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#475467' }}>classification node</div>
            </div>
            {!collapsed.has(classification) && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 16 }}>
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(15,23,42,0.12)',
                      background: '#fff',
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{entry.abbreviation || '무명'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{entry.description || '설명이 없습니다.'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff' }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={operationPending}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #fecaca',
                            background: '#fee2e2',
                            color: '#991b1b',
                            cursor: operationPending ? 'not-allowed' : 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: '#475467' }}>Input</div>
                        <div>{entry.input_value || '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: '#475467' }}>Unit</div>
                        <div>{entry.unit || '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: '#475467' }}>Remark</div>
                        <div>{entry.remark || '-'}</div>
                      </div>
                    </div>
                    {editingId === entry.id && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          borderRadius: 8,
                          border: '1px dashed #cbd5f5',
                          background: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'nowrap',
                            gap: 8,
                            alignItems: 'stretch',
                            overflowX: 'auto',
                            paddingBottom: 4,
                          }}
                        >
                          <div style={{ flex: '0 0 150px', minWidth: 120 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>분류</label>
                            <input
                              value={editingValues.classification}
                              placeholder="분류"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, classification: e.target.value }))}
                              style={inlineFieldStyle}
                            />
                          </div>
                          <div style={{ flex: '0 0 120px', minWidth: 110 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>Abbreviation</label>
                            <input
                              value={editingValues.abbreviation}
                              placeholder="Abbreviation"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, abbreviation: e.target.value }))}
                              style={inlineFieldStyle}
                            />
                          </div>
                          <div style={{ flex: '0 0 220px', minWidth: 160 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>Description</label>
                            <textarea
                              value={editingValues.description}
                              placeholder="Description"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, description: e.target.value }))}
                              style={textareaFieldStyle}
                            />
                          </div>
                          <div style={{ flex: '0 0 150px', minWidth: 120 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>Input</label>
                            <input
                              value={editingValues.input_value}
                              placeholder="Input"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, input_value: e.target.value }))}
                              style={inlineFieldStyle}
                            />
                          </div>
                          <div style={{ flex: '0 0 130px', minWidth: 100 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>Unit</label>
                            <input
                              value={editingValues.unit}
                              placeholder="Unit"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, unit: e.target.value }))}
                              style={inlineFieldStyle}
                            />
                          </div>
                          <div style={{ flex: '0 0 220px', minWidth: 160 }}>
                            <label style={{ fontSize: 12, color: '#475467' }}>Remark</label>
                            <textarea
                              value={editingValues.remark}
                              placeholder="Remark"
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, remark: e.target.value }))}
                              style={textareaFieldStyle}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={operationPending}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff' }}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff' }}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

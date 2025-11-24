import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import StandardTreeManager from './StandardTreeManager';

const buildFamilyTree = (items) => {
  const map = new Map();
  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  const roots = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

export default function TeamStandardFamilyList() {
  const [familyItems, setFamilyItems] = useState([]);
  const [filterType, setFilterType] = useState('ALL');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingParentId, setAddingParentId] = useState(undefined);
  const [addingName, setAddingName] = useState('');
  const [addingType, setAddingType] = useState('CATEGORY');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [addingSequence, setAddingSequence] = useState('');

  const refreshFamilyItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/family-list/`);
      if (!response.ok) {
        throw new Error('FamilyList를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      setFamilyItems(data);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFamilyItems();
  }, [refreshFamilyItems]);

  const filteredItems = useMemo(() => {
    if (filterType === 'ALL') return familyItems;
    return familyItems.filter((item) => item.item_type === filterType);
  }, [familyItems, filterType]);

  const familyTree = useMemo(() => buildFamilyTree(filteredItems), [filteredItems]);

  const cancelAdd = () => {
    setAddingParentId(undefined);
    setAddingName('');
    setAddingType('CATEGORY');
    setAddingSequence('');
  };

  const handleAdd = (parentId = null) => {
    setAddingParentId(parentId);
    setAddingName('');
    setAddingType(parentId ? 'FAMILY' : 'CATEGORY');
    setAddingSequence('');
    setStatus(null);
  };

  const submitCreate = async () => {
    const trimmed = addingName.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: '항목 이름을 입력하세요.' });
      return;
    }
    if (addingType === 'FAMILY' && !addingSequence.trim()) {
      setStatus({ type: 'error', message: 'Family 번호를 입력하세요.' });
      return;
    }
    try {
      const rawSequenceValue = addingSequence ?? '';
      const normalizedSequenceValue =
        typeof rawSequenceValue === 'string'
          ? rawSequenceValue
          : String(rawSequenceValue);
      const sequenceNumber =
        addingType === 'FAMILY' && normalizedSequenceValue.trim()
          ? normalizedSequenceValue.trim()
          : undefined;

      const payload = {
        name: trimmed,
        item_type: addingType,
        parent_id: addingParentId,
        sequence_number: sequenceNumber,
      };
      const response = await fetch(`${API_BASE_URL}/family-list/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody
          ? typeof errorBody.detail === 'string'
            ? errorBody.detail
            : JSON.stringify(errorBody.detail || errorBody)
          : '생성에 실패했습니다.';
        throw new Error(message);
      }
      setStatus({ type: 'success', message: '가족 항목이 등록되었습니다.' });
      cancelAdd();
      await refreshFamilyItems();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const startEdit = (node) => {
    setEditingId(node.id);
    setEditingName(node.name);
    setStatus(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const submitEdit = async (nodeId) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: '새 이름을 입력하세요.' });
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/family-list/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody
          ? typeof errorBody.detail === 'string'
            ? errorBody.detail
            : JSON.stringify(errorBody.detail || errorBody)
          : '수정에 실패했습니다.';
        throw new Error(message);
      }
      setStatus({ type: 'success', message: '이름이 수정되었습니다.' });
      cancelEdit();
      await refreshFamilyItems();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleDelete = async (nodeId) => {
    if (!window.confirm('정말 삭제하시겠습니까? 하위 항목도 함께 삭제됩니다.')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/family-list/${nodeId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody
          ? typeof errorBody.detail === 'string'
            ? errorBody.detail
            : JSON.stringify(errorBody.detail || errorBody)
          : '삭제에 실패했습니다.';
        throw new Error(message);
      }
      setStatus({ type: 'success', message: '항목이 삭제되었습니다.' });
      await refreshFamilyItems();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const renderFamilyNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginLeft: level * 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {level > 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>{'·'.repeat(level)}</span>}
            {editingId === node.id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{ padding: 4, borderRadius: 4, border: '1px solid #d1d5db', minWidth: 140 }}
                />
                <button
                  type="button"
                  onClick={() => submitEdit(node.id)}
                  style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5f5' }}
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5f5' }}
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {node.name}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>({node.item_type})</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {level < 2 && (
              <button
                type="button"
                onClick={() => handleAdd(node.id)}
                style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5f5', fontSize: 11 }}
              >
                추가
              </button>
            )}
            <button
              type="button"
              onClick={() => startEdit(node)}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5f5', fontSize: 11 }}
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => handleDelete(node.id)}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #fecaca', background: '#fee2e2', fontSize: 11 }}
            >
              삭제
            </button>
          </div>
        </div>
        {hasChildren && (
          <div style={{ paddingLeft: 12, borderLeft: level === 0 ? '1px solid #e5e7eb' : 'none' }}>
            {node.children.map((child) => renderFamilyNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 24,
      }}
    >
      <header>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>Team Standard Family List</div>
        <p style={{ margin: '6px 0 0', color: '#475467', lineHeight: 1.6 }}>
          좌측의 표준 트리 위젯을 기준으로 베이스를 확인하고, 우측에서는 FamilyList 테이블을 기반으로 가족 계층을 실시간 관리합니다.
        </p>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
        <div
          style={{
            flex: '0 0 480px',
            minHeight: 0,
            borderRadius: 14,
            background: '#fff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #eef2ff', fontSize: 13, fontWeight: 600, color: '#475467' }}>
            Standard Tree
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <StandardTreeManager />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 14,
            background: '#fff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #eef2ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475467' }}>Family Tree View</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleAdd(null)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff', fontSize: 12 }}
              >
                루트 항목 추가
              </button>
              <button
                type="button"
                onClick={refreshFamilyItems}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff', fontSize: 12 }}
              >
                새로고침
              </button>
            </div>
          </div>
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #eef2ff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>필터:</span>
            {['ALL', 'CATEGORY', 'FAMILY'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #cbd5f5',
                  background: filterType === type ? '#eef2ff' : '#fff',
                  fontSize: 11,
                  fontWeight: filterType === type ? 700 : 500,
                }}
              >
                {type === 'CATEGORY' ? 'Category' : type === 'FAMILY' ? 'Family' : 'All'}
              </button>
            ))}
            <span style={{ marginLeft: 'auto' }}>
              Data source: <strong>FamilyList</strong>
            </span>
          </div>
          {status && (
            <div
              style={{
                padding: 8,
                borderBottom: '1px solid #eef2ff',
                fontSize: 12,
                color: status.type === 'error' ? '#991b1b' : '#047857',
                background: status.type === 'error' ? '#fef2f2' : '#ecfdf3',
              }}
            >
              {status.message}
            </div>
          )}
          {addingParentId !== undefined && (
            <div style={{ padding: 12, borderBottom: '1px dashed #cbd5f5', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <input
                value={addingName}
                onChange={(e) => setAddingName(e.target.value)}
                placeholder="새 항목 이름"
                style={{ flex: '1 1 180px', padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
              />
              {addingType === 'FAMILY' && (
                <input
                  type="text"
                  value={addingSequence}
                  onChange={(e) => setAddingSequence(e.target.value)}
                  placeholder="번호"
                  style={{ flex: '0 0 120px', padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              )}
              <select
                  value={addingType}
                  onChange={(e) => setAddingType(e.target.value)}
                  style={{ padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
                >
                  <option value="CATEGORY">Category</option>
                  <option value="FAMILY">Family</option>
                </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={submitCreate}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12 }}
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={cancelAdd}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff', fontSize: 12 }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ color: '#64748b', fontSize: 12 }}>데이터를 불러오는 중입니다...</div>
            ) : familyTree.length > 0 ? (
              familyTree.map((node) => renderFamilyNode(node))
            ) : (
              <div style={{ color: '#64748b', fontSize: 12 }}>등록된 가족 항목이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
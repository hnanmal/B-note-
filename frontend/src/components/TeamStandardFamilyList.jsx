import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const normalizeAssignmentIds = (values) => {
  const iterable =
    values instanceof Set ? Array.from(values) : Array.isArray(values) ? values : [];
  const normalized = [];
  iterable.forEach((value) => {
    const num = Number(value);
    if (Number.isFinite(num)) {
      normalized.push(num);
    }
  });
  normalized.sort((a, b) => a - b);
  return { array: normalized, key: normalized.join(',') };
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
  const [editingSequence, setEditingSequence] = useState('');
  const [editingItemType, setEditingItemType] = useState('CATEGORY');
  const [editingDescription, setEditingDescription] = useState('');
  const [addingSequence, setAddingSequence] = useState('');
  const [selectedFamilyNode, setSelectedFamilyNode] = useState(null);
  const [calcDictionaryEntries, setCalcDictionaryEntries] = useState([]);
  const [calcDictionaryLoading, setCalcDictionaryLoading] = useState(false);
  const [calcDictionaryError, setCalcDictionaryError] = useState(null);
  const [newCalcSymbolKey, setNewCalcSymbolKey] = useState('');
  const [newCalcSymbolValue, setNewCalcSymbolValue] = useState('');
  const [newCalcCodeInput, setNewCalcCodeInput] = useState('');
  const [creatingCalcEntry, setCreatingCalcEntry] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [selectedStdItems, setSelectedStdItems] = useState(() => new Set());
  const assignmentSyncBlocked = useRef(false);
  const lastSyncedAssignmentKey = useRef('');
  const loadAssignmentsController = useRef(null);
  const saveAssignmentsController = useRef(null);
  const handleCheckboxSelectionChange = useCallback((ids = []) => {
    const normalized = normalizeAssignmentIds(ids).array;
    setSelectedStdItems(new Set(normalized));
  }, []);

  const fetchAssignmentsForFamily = useCallback(
    async (signal) => {
      if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/assignments`,
          signal ? { signal } : undefined
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            body?.detail || body?.message || '할당 데이터를 불러오는 데 실패했습니다.';
          throw new Error(message);
        }
        const payload = await response.json().catch(() => []);
        const assignmentIds = Array.isArray(payload)
          ? payload
              .map((entry) => entry?.standard_item_id)
              .filter((value) => Number.isFinite(Number(value)))
          : [];
        const normalized = normalizeAssignmentIds(assignmentIds);
        assignmentSyncBlocked.current = true;
        lastSyncedAssignmentKey.current = normalized.key;
        setSelectedStdItems(new Set(normalized.array));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setStatus({ type: 'error', message: error.message });
      }
    },
    [selectedFamilyNode]
  );

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

  useEffect(() => {
    if (selectedFamilyNode?.item_type === 'FAMILY') {
      setNewCalcCodeInput((selectedFamilyNode.sequence_number ?? '').trim());
    } else {
      setNewCalcCodeInput('');
    }
  }, [selectedFamilyNode]);

  const loadCalcDictionary = useCallback(
    async (signal) => {
      if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') return;
      setCalcDictionaryLoading(true);
      setCalcDictionaryError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/calc-dictionary`,
          signal ? { signal } : undefined
        );
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
          if (!response.ok) {
            throw new Error('calc_dictionary 데이터를 불러오는 데 실패했습니다.');
          }
        }

        if (!response.ok) {
          const detailMessage =
            payload?.detail || payload?.message || 'calc_dictionary 데이터를 불러오는 데 실패했습니다.';
          throw new Error(detailMessage);
        }

        setCalcDictionaryEntries(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setCalcDictionaryError(error.message);
      } finally {
        setCalcDictionaryLoading(false);
      }
    },
    [selectedFamilyNode]
  );

  useEffect(() => {
    if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') {
      setCalcDictionaryEntries([]);
      setCalcDictionaryLoading(false);
      setCalcDictionaryError(null);
      return;
    }

    const controller = new AbortController();
    loadCalcDictionary(controller.signal);
    return () => controller.abort();
  }, [loadCalcDictionary, selectedFamilyNode]);

  const cleanedCalcCode = selectedFamilyNode?.sequence_number?.trim();
  const matchingCalcDictionaryEntries = useMemo(() => {
    if (!cleanedCalcCode) return [];
    return calcDictionaryEntries.filter((entry) => (entry.calc_code || '').trim() === cleanedCalcCode);
  }, [calcDictionaryEntries, cleanedCalcCode]);
  const isFamilySelected = selectedFamilyNode?.item_type === 'FAMILY';
  const checkboxSelectionCount = selectedStdItems.size;
  const assignmentModeInfoText = assignmentMode
    ? checkboxSelectionCount
      ? `${checkboxSelectionCount}개의 최상위 항목 다음 레벨 항목이 체크되어 있습니다.`
      : '최상위 항목 바로 아래 레벨 체크박스를 사용해 대상 표준 항목을 선택하세요.'
    : '버튼을 눌러 Standard GWM Tree에서 최상위 항목 다음 레벨의 체크박스를 활성화하세요.';
  const assignmentSummaryText = checkboxSelectionCount
    ? `${checkboxSelectionCount}개 선택된 표준 항목`
    : '선택된 표준 항목이 없습니다.';

  useEffect(() => {
    if (!assignmentMode) {
      if (loadAssignmentsController.current) {
        loadAssignmentsController.current.abort();
        loadAssignmentsController.current = null;
      }
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
      assignmentSyncBlocked.current = false;
      lastSyncedAssignmentKey.current = '';
      setSelectedStdItems(new Set());
      return;
    }

    if (!isFamilySelected) {
      if (loadAssignmentsController.current) {
        loadAssignmentsController.current.abort();
        loadAssignmentsController.current = null;
      }
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
      return;
    }

    const controller = new AbortController();
    loadAssignmentsController.current = controller;
    fetchAssignmentsForFamily(controller.signal);
    return () => {
      controller.abort();
      if (loadAssignmentsController.current === controller) {
        loadAssignmentsController.current = null;
      }
    };
  }, [assignmentMode, isFamilySelected, fetchAssignmentsForFamily]);

  useEffect(() => {
    if (!assignmentMode) {
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
      return;
    }

    if (!isFamilySelected || !selectedFamilyNode) {
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
      return;
    }

    if (assignmentSyncBlocked.current) {
      assignmentSyncBlocked.current = false;
      return;
    }

    const normalized = normalizeAssignmentIds(selectedStdItems);
    const idsToSend = normalized.array;
    const key = normalized.key;
    if (lastSyncedAssignmentKey.current === key) {
      return;
    }

    const controller = new AbortController();
    if (saveAssignmentsController.current) {
      saveAssignmentsController.current.abort();
    }
    saveAssignmentsController.current = controller;

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/assignments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ standard_item_ids: idsToSend }),
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            body?.detail || body?.message || '할당을 저장하지 못했습니다.';
          throw new Error(message);
        }
        lastSyncedAssignmentKey.current = key;
      } catch (error) {
        if (error.name === 'AbortError') return;
        setStatus({ type: 'error', message: error.message });
      } finally {
        if (saveAssignmentsController.current === controller) {
          saveAssignmentsController.current = null;
        }
      }
    })();

    return () => {
      controller.abort();
      if (saveAssignmentsController.current === controller) {
        saveAssignmentsController.current = null;
      }
    };
  }, [assignmentMode, isFamilySelected, selectedStdItems, selectedFamilyNode]);

  const handleCreateCalcEntry = async () => {
    if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') return;
    const symbolKey = newCalcSymbolKey.trim();
    const symbolValue = newCalcSymbolValue.trim();
    if (!symbolKey || !symbolValue) {
      setCalcDictionaryError('심벌 키와 값은 필수입니다.');
      return;
    }
    setCalcDictionaryError(null);
    setCreatingCalcEntry(true);
    try {
      const payload = {
        symbol_key: symbolKey,
        symbol_value: symbolValue,
      };
      const trimmedCalcCode = newCalcCodeInput.trim();
      if (trimmedCalcCode) payload.calc_code = trimmedCalcCode;
      const response = await fetch(
        `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/calc-dictionary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.detail || body?.message || 'calc_dictionary 항목을 저장하지 못했습니다.';
        throw new Error(message);
      }
      setNewCalcSymbolKey('');
      setNewCalcSymbolValue('');
      setNewCalcCodeInput((selectedFamilyNode.sequence_number ?? '').trim());
      await loadCalcDictionary();
    } catch (error) {
      if (error.name !== 'AbortError') {
        setCalcDictionaryError(error.message);
      }
    } finally {
      setCreatingCalcEntry(false);
    }
  };

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
    setEditingSequence(node.sequence_number ?? '');
    setEditingItemType(node.item_type || 'CATEGORY');
    setEditingDescription(node.description ?? '');
    setStatus(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingSequence('');
    setEditingItemType('CATEGORY');
    setEditingDescription('');
  };

  const submitEdit = async (nodeId) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: '새 이름을 입력하세요.' });
      return;
    }
    try {
      const normalizedSequence = editingSequence.trim();
      const normalizedDescription = editingDescription.trim();
      const original = familyItems.find((item) => item.id === nodeId);
      const payload = { name: trimmed };

      if (editingItemType !== (original?.item_type || 'CATEGORY')) {
        payload.item_type = editingItemType;
      }

      const originalSequence = (original?.sequence_number ?? '').toString().trim();
      if (normalizedSequence !== originalSequence) {
        payload.sequence_number = normalizedSequence;
      }

      const originalDescription = (original?.description ?? '').toString().trim();
      if (normalizedDescription !== originalDescription) {
        payload.description = normalizedDescription;
      }

      const response = await fetch(`${API_BASE_URL}/family-list/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      setStatus({ type: 'success', message: '항목이 수정되었습니다.' });
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

  const handleFamilySelect = (node) => {
    setSelectedFamilyNode(node);
  };

  const renderFamilyNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isFamily = node.item_type === 'FAMILY';
    const hasSequence = Boolean(isFamily && node.sequence_number);
    const description = node.description?.trim();
    const isSelected = selectedFamilyNode?.id === node.id;
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #d1d5db', minWidth: 140, flex: '1 1 180px' }}
                  />
                  <select
                    value={editingItemType}
                    onChange={(e) => setEditingItemType(e.target.value)}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                  >
                    <option value="CATEGORY">Category</option>
                    <option value="FAMILY">Family</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Sequence"
                    value={editingSequence}
                    onChange={(e) => setEditingSequence(e.target.value)}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #d1d5db', minWidth: 100 }}
                  />
                </div>
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="설명 (선택)"
                  rows={2}
                  style={{ width: '100%', minWidth: 0, padding: 6, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
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
              </div>
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleFamilySelect(node)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFamilySelect(node);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                    borderRadius: 6,
                    padding: '4px 6px',
                    background: isSelected ? '#e7f4ff' : 'transparent',
                  }}
                >
                  {hasSequence && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0f172a',
                        padding: '0 6px',
                        borderRadius: 4,
                        background: '#e0f2fe',
                      }}
                    >
                      {node.sequence_number}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {node.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>({node.item_type})</span>
                </div>
                {description && (
                  <div style={{ fontSize: 11, color: '#475467', marginLeft: level * 16 + 8 }}>
                    {description}
                  </div>
                )}
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
            <div style={{ flex: 1, minHeight: 0 }}>
              <StandardTreeManager
                // enable checkboxes only when assignmentMode is active AND a Family node is selected
                level2CheckboxesEnabled={assignmentMode && isFamilySelected}
                checkboxDepth={1}
                onCheckboxSelectionChange={handleCheckboxSelectionChange}
                externalCheckboxSelection={Array.from(selectedStdItems)}
              />
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
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #eef2ff',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAssignmentMode((prev) => !prev)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: '1px solid #2563eb',
                  background: assignmentMode ? '#1d4ed8' : '#eff6ff',
                  color: assignmentMode ? '#fff' : '#1d4ed8',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {assignmentMode ? '할당 모드 종료' : 'GWM / SWM 할당'}
              </button>
              <span style={{ fontSize: 12, color: '#475467' }}>
                {assignmentMode
                  ? isFamilySelected
                    ? '레벨2 항목 체크박스 활성화 중'
                    : 'Family 항목을 먼저 선택해야 체크박스를 사용할 수 있습니다.'
                  : '레벨2 항목 체크박스를 켜면 선택이 가능합니다.'}
              </span>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#475467', fontWeight: 600 }}>{assignmentSummaryText}</div>
            </div>
            <div style={{ width: '100%', fontSize: 11, color: '#64748b' }}>{assignmentModeInfoText}</div>
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
        <div
          style={{
            flex: '0 0 320px',
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
          <div style={{ padding: 16, borderBottom: '1px solid #eef2ff', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475467' }}>Calc Dictionary</div>
            {isFamilySelected && selectedFamilyNode ? (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Seq#{selectedFamilyNode.sequence_number || '—'}</div>
            ) : (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Family 항목을 선택하면, 일치하는 calc_code를 보여줍니다.</div>
            )}
          </div>
          {isFamilySelected && (
            <div
              style={{
                padding: '0 16px 12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                background: '#f9fafb',
                borderBottom: '1px solid #eef2ff',
              }}
            >
              <input
                placeholder="Calc Code"
                value={newCalcCodeInput}
                onChange={(e) => setNewCalcCodeInput(e.target.value)}
                style={{ flex: '1 1 120px', padding: 6, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 120 }}
              />
              <input
                placeholder="Symbol Key"
                value={newCalcSymbolKey}
                onChange={(e) => setNewCalcSymbolKey(e.target.value)}
                style={{ flex: '1 1 140px', padding: 6, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 140 }}
              />
              <input
                placeholder="Symbol Value"
                value={newCalcSymbolValue}
                onChange={(e) => setNewCalcSymbolValue(e.target.value)}
                style={{ flex: '1 1 180px', padding: 6, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 160 }}
              />
              <button
                type="button"
                onClick={handleCreateCalcEntry}
                disabled={creatingCalcEntry || !newCalcSymbolKey.trim() || !newCalcSymbolValue.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #2563eb',
                  background: creatingCalcEntry ? '#93c5fd' : '#2563eb',
                  color: '#fff',
                  fontSize: 12,
                  cursor: creatingCalcEntry ? 'not-allowed' : 'pointer',
                }}
              >
                {creatingCalcEntry ? '저장 중...' : '새 항목 추가'}
              </button>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!selectedFamilyNode && (
              <div style={{ color: '#64748b', fontSize: 12 }}>Tree에서 Family 항목을 먼저 선택해주세요.</div>
            )}
            {selectedFamilyNode && !isFamilySelected && (
              <div style={{ color: '#64748b', fontSize: 12 }}>Family 타입 항목만 calc dictionary를 지원합니다.</div>
            )}
            {isFamilySelected && (
              <>
                {calcDictionaryLoading && (
                  <div style={{ color: '#0f172a', fontSize: 12 }}>관련 calc_dictionary를 불러오는 중입니다...</div>
                )}
                {calcDictionaryError && (
                  <div style={{ color: '#b91c1c', fontSize: 12 }}>{calcDictionaryError}</div>
                )}
                {!calcDictionaryLoading && !calcDictionaryError && (
                  matchingCalcDictionaryEntries.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#475467',
                          borderBottom: '1px solid #e5e7eb',
                          paddingBottom: 6,
                        }}
                      >
                        <span>Calc Code</span>
                        <span>심벌키</span>
                        <span>심벌값</span>
                      </div>
                      {matchingCalcDictionaryEntries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: 12,
                            fontSize: 13,
                            color: '#0f172a',
                            padding: '4px 0',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{entry.calc_code || '—'}</span>
                          <span>{entry.symbol_key}</span>
                          <span>{entry.symbol_value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: 12 }}>선택된 순번과 calc_code가 일치하는 항목이 없습니다.</div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
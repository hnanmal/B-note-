import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import StandardTreeManager from './StandardTreeManager';

const parseSequenceIdentifier = (value) => {
  const trimmed = value?.toString()?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)*)([a-zA-Z]*)/);
  if (!match) return null;
  const numbers = match[1].split('.').map((segment) => Number(segment));
  if (numbers.some((num) => !Number.isFinite(num))) return null;
  return {
    numbers,
    suffix: match[2] ? match[2].toLowerCase() : '',
  };
};

const normalizeSequenceString = (value) => {
  if (value === undefined || value === null) return value;
  return value?.toString?.().trim?.() ?? '';
};

const getSequenceIdentifier = (node) => {
  return parseSequenceIdentifier(node.sequence_number) ?? parseSequenceIdentifier(node.name);
};

const compareSequenceIdentifiers = (a, b) => {
  const maxLength = Math.max(a.numbers.length, b.numbers.length);
  for (let i = 0; i < maxLength; i += 1) {
    const valueA = i < a.numbers.length ? a.numbers[i] : 0;
    const valueB = i < b.numbers.length ? b.numbers[i] : 0;
    if (valueA !== valueB) return valueA - valueB;
  }
  if (a.suffix !== b.suffix) {
    if (!a.suffix) return -1;
    if (!b.suffix) return 1;
    return a.suffix.localeCompare(b.suffix, undefined, { sensitivity: 'base' });
  }
  return 0;
};

const compareFamilyNodes = (a, b) => {
  const identifierA = getSequenceIdentifier(a);
  const identifierB = getSequenceIdentifier(b);
  if (identifierA && identifierB) {
    const comparison = compareSequenceIdentifiers(identifierA, identifierB);
    if (comparison !== 0) return comparison;
  } else if (identifierA) {
    return -1;
  } else if (identifierB) {
    return 1;
  }
  const nameA = (a?.name ?? '').trim();
  const nameB = (b?.name ?? '').trim();
  if (!nameA) return nameB ? 1 : 0;
  if (!nameB) return -1;
  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
};

const sortFamilyTreeNodes = (nodes) => {
  nodes.sort(compareFamilyNodes);
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      sortFamilyTreeNodes(node.children);
    }
  });
};

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

  sortFamilyTreeNodes(roots);

  return roots;
};

const flattenFamilyTreeNodes = (nodes = [], accumulator = []) => {
  nodes.forEach((node) => {
    accumulator.push(node);
    if (node.children && node.children.length > 0) {
      flattenFamilyTreeNodes(node.children, accumulator);
    }
  });
  return accumulator;
};

const getScrollTargetIdForDeletion = (nodeId, renderedItems) => {
  if (!nodeId || !renderedItems || renderedItems.length === 0) return null;
  const snapshotItems = renderedItems.map((item) => ({ ...item }));
  const treeSnapshot = buildFamilyTree(snapshotItems);
  const flattened = flattenFamilyTreeNodes(treeSnapshot);
  if (!flattened.length) return null;
  const currentIndex = flattened.findIndex((item) => item.id === nodeId);
  if (currentIndex > 0) {
    return flattened[currentIndex - 1]?.id ?? null;
  }
  const alternative = flattened.find((item) => item.id !== nodeId);
  return alternative?.id ?? null;
};

const ASSIGNMENT_CHECKBOX_DEPTH = 1;

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

const buildStandardTreeWithDepth = (items) => {
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

  const ancestorMap = new Map();
  const walk = (node, depth = 0, currentAncestor = null) => {
    const nextAncestor = depth === ASSIGNMENT_CHECKBOX_DEPTH ? node.id : currentAncestor;
    ancestorMap.set(node.id, nextAncestor);
    (node.children || []).forEach((child) => walk(child, depth + 1, nextAncestor));
  };
  roots.forEach((root) => walk(root));

  return { roots, ancestorMap };
};

const cloneNodeWithChildren = (node) => {
  return {
    ...node,
    children: (node.children || []).map((child) => cloneNodeWithChildren(child)),
  };
};

const buildAssignedSubtree = (nodes, assignedRoots, ancestorMap, metadata) => {
  const result = [];
  nodes.forEach((node) => {
    const ancestorId = ancestorMap.get(node.id);
    if (ancestorId && assignedRoots.has(ancestorId)) {
      const clone = cloneNodeWithChildren(node);
      clone.metadata = metadata.get(node.id) ?? null;
      result.push(clone);
      return;
    }
    const childMatches = buildAssignedSubtree(node.children || [], assignedRoots, ancestorMap, metadata);
    if (childMatches.length) {
      const clone = { ...node, children: childMatches };
      clone.metadata = metadata.get(node.id) ?? null;
      result.push(clone);
    }
  });
  return result;
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
  const [copiedCalcEntries, setCopiedCalcEntries] = useState([]);
  const [copiedFromSequence, setCopiedFromSequence] = useState('');
  const [batchCopyLoading, setBatchCopyLoading] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [selectedStdItems, setSelectedStdItems] = useState(() => new Set());
  const [standardItems, setStandardItems] = useState([]);
  const [standardTree, setStandardTree] = useState([]);
  const [standardTreeError, setStandardTreeError] = useState(null);
  const [checkboxAncestorMap, setCheckboxAncestorMap] = useState(() => new Map());
  const [assignmentMetadata, setAssignmentMetadata] = useState(() => new Map());
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editingAssignmentFields, setEditingAssignmentFields] = useState({
    formula: '',
    description: '',
  });
  const treeContainerRef = useRef(null);
  const addNameInputRef = useRef(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState(null);
  const [pendingScrollNodeId, setPendingScrollNodeId] = useState(null);
  const assignmentSyncBlocked = useRef(false);
  const lastSyncedAssignmentKey = useRef('');
  const loadAssignmentsController = useRef(null);
  const saveAssignmentsController = useRef(null);
  const pendingSave = useRef({ ids: [], key: '' });
  const saveTimer = useRef(null);
  const isSavingAssignment = useRef(false);
  const performSaveRef = useRef(() => {});
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
        const metadataMap = new Map();
        if (Array.isArray(payload)) {
          payload.forEach((entry) => {
            if (!entry) return;
            const id = Number(entry.standard_item_id);
            if (!Number.isFinite(id)) return;
            metadataMap.set(id, {
              id: entry.id,
              formula: entry.formula ?? null,
              description: entry.description ?? null,
            });
          });
        }
        const rootCandidates = new Set();
        assignmentIds.forEach((id) => {
          const ancestor = checkboxAncestorMap.get(id);
          if (ancestor != null) {
            rootCandidates.add(ancestor);
          }
        });
        const effectiveIds =
          rootCandidates.size > 0 ? Array.from(rootCandidates) : assignmentIds;
        const normalized = normalizeAssignmentIds(effectiveIds);
        assignmentSyncBlocked.current = true;
  lastSyncedAssignmentKey.current = normalized.key;
  setAssignmentMetadata(metadataMap);
        setSelectedStdItems(new Set(normalized.array));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setStatus({ type: 'error', message: error.message });
      }
    },
    [selectedFamilyNode, checkboxAncestorMap]
  );

  const handleStartAssignmentEdit = useCallback(
    (node) => {
      const metadata = assignmentMetadata.get(node.id) ?? node.metadata;
      if (!metadata?.id) return;
      setEditingAssignmentId(metadata.id);
      setEditingAssignmentFields({
        formula: metadata.formula ?? '',
        description: metadata.description ?? '',
      });
    },
    [assignmentMetadata]
  );

  const handleCancelAssignmentEdit = useCallback(() => {
    setEditingAssignmentId(null);
    setEditingAssignmentFields({ formula: '', description: '' });
  }, []);

  const handleAssignmentFieldChange = useCallback((field, value) => {
    setEditingAssignmentFields((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveAssignmentMetadata = useCallback(async () => {
    if (!editingAssignmentId || !selectedFamilyNode) return;
    try {
      const trimmedFormula = editingAssignmentFields.formula.trim();
      const trimmedDescription = editingAssignmentFields.description.trim();
      const payload = {
        formula: trimmedFormula === '' ? null : trimmedFormula,
        description: trimmedDescription === '' ? null : trimmedDescription,
      };
      const response = await fetch(
        `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/assignments/${editingAssignmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.detail || body?.message || '할당 메타데이터를 저장하지 못했습니다.';
        throw new Error(message);
      }
      const updated = await response.json();
      setAssignmentMetadata((prev) => {
        const next = new Map(prev);
        const standardItemId = Number(updated?.standard_item_id);
        if (Number.isFinite(standardItemId)) {
          next.set(standardItemId, {
            id: updated.id,
            formula: updated.formula ?? null,
            description: updated.description ?? null,
          });
        }
        return next;
      });
      setStatus({ type: 'success', message: '메타데이터가 저장되었습니다.' });
      handleCancelAssignmentEdit();
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus({ type: 'error', message: error.message });
    }
  }, [editingAssignmentId, editingAssignmentFields, selectedFamilyNode, handleCancelAssignmentEdit]);

  const refreshFamilyItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/family-list/`);
      if (!response.ok) {
        throw new Error('FamilyList를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      const normalizedFamilyItems = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            sequence_number: normalizeSequenceString(item.sequence_number),
          }))
        : [];
      setFamilyItems(normalizedFamilyItems);
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
    if (addingParentId === undefined || !addNameInputRef.current) return;
    const rafId = window.requestAnimationFrame(() => {
      addNameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [addingParentId]);

  useEffect(() => {
    if (!pendingFocusNodeId) return;
    const matched = familyItems.find((item) => item.id === pendingFocusNodeId);
    if (!matched) return;
    setSelectedFamilyNode(matched);
    setPendingFocusNodeId(null);
    setPendingScrollNodeId(matched.id);
  }, [familyItems, pendingFocusNodeId]);

  const pendingScrollRetry = useRef(0);
  useEffect(() => {
    if (!pendingScrollNodeId) return;
    const container = treeContainerRef.current;
    const attemptScroll = () => {
      const target = container?.querySelector(
        `[data-family-node-id="${pendingScrollNodeId}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPendingScrollNodeId(null);
        pendingScrollRetry.current = 0;
        return;
      }
      if (pendingScrollRetry.current < 4) {
        pendingScrollRetry.current += 1;
        setTimeout(attemptScroll, 80);
      } else {
        setPendingScrollNodeId(null);
        pendingScrollRetry.current = 0;
      }
    };
    attemptScroll();
  }, [pendingScrollNodeId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/standard-items/`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message =
            errorBody?.detail || errorBody?.message || '표준 항목을 불러오는 데 실패했습니다.';
          throw new Error(message);
        }
        const payload = await response.json();
        if (!active) return;
        setStandardItems(Array.isArray(payload) ? payload : []);
        setStandardTreeError(null);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setStandardTreeError(error.message);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const { roots, ancestorMap } = buildStandardTreeWithDepth(standardItems);
    setStandardTree(roots);
    setCheckboxAncestorMap(ancestorMap);
  }, [standardItems]);

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

  const normalizedAssignedStandardIds = useMemo(() => {
    const ids = new Set();
    selectedStdItems.forEach((value) => {
      const num = Number(value);
      if (Number.isFinite(num)) {
        ids.add(num);
      }
    });
    return ids;
  }, [selectedStdItems]);

  const assignedStandardTree = useMemo(() => {
    if (!normalizedAssignedStandardIds.size || !standardTree.length) {
      return [];
    }
    return buildAssignedSubtree(
      standardTree,
      normalizedAssignedStandardIds,
      checkboxAncestorMap,
      assignmentMetadata
    );
  }, [standardTree, normalizedAssignedStandardIds, checkboxAncestorMap, assignmentMetadata]);

  const clearPendingSave = useCallback(() => {
    pendingSave.current = { ids: [], key: '' };
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const scheduleSave = useCallback((ids, key, delay = 150) => {
    pendingSave.current = { ids, key };
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    if (isSavingAssignment.current) {
      return;
    }
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      performSaveRef.current();
    }, delay);
  }, []);

  const performSave = useCallback(async () => {
    if (!assignmentMode || !isFamilySelected || !selectedFamilyNode) {
      isSavingAssignment.current = false;
      return;
    }
    const pending = pendingSave.current;
    const hasAssignments = pending.ids && pending.ids.length > 0;
    const alreadyCleared = !hasAssignments && lastSyncedAssignmentKey.current === '';
    const keyMatches = hasAssignments && pending.key === lastSyncedAssignmentKey.current;
    if (alreadyCleared || keyMatches) {
      isSavingAssignment.current = false;
      return;
    }
    if (isSavingAssignment.current) {
      return;
    }
    isSavingAssignment.current = true;
    if (saveAssignmentsController.current) {
      saveAssignmentsController.current.abort();
    }
    const controller = new AbortController();
    saveAssignmentsController.current = controller;
    try {
      const response = await fetch(
        `${API_BASE_URL}/family-list/${selectedFamilyNode.id}/assignments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ standard_item_ids: pending.ids }),
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.detail || body?.message || '할당을 저장하지 못했습니다.';
        throw new Error(message);
      }
      lastSyncedAssignmentKey.current = pending.key;
      fetchAssignmentsForFamily();
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus({ type: 'error', message: error.message });
    } finally {
      if (saveAssignmentsController.current === controller) {
        saveAssignmentsController.current = null;
      }
      isSavingAssignment.current = false;
      if (
        pendingSave.current.key &&
        pendingSave.current.key !== lastSyncedAssignmentKey.current
      ) {
        scheduleSave(pendingSave.current.ids, pendingSave.current.key, 0);
      }
    }
  }, [assignmentMode, isFamilySelected, selectedFamilyNode, scheduleSave, fetchAssignmentsForFamily]);

  performSaveRef.current = performSave;

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
      setAssignmentMetadata(new Map());
      setEditingAssignmentId(null);
      setEditingAssignmentFields({ formula: '', description: '' });
      clearPendingSave();
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
      setAssignmentMetadata(new Map());
      setEditingAssignmentId(null);
      setEditingAssignmentFields({ formula: '', description: '' });
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
  }, [assignmentMode, isFamilySelected, fetchAssignmentsForFamily, clearPendingSave]);

  useEffect(() => {
    if (!assignmentMode) {
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
      clearPendingSave();
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

    scheduleSave(idsToSend, key);
  }, [assignmentMode, isFamilySelected, selectedStdItems, selectedFamilyNode, scheduleSave, clearPendingSave]);

  useEffect(() => {
    return () => {
      clearPendingSave();
      if (saveAssignmentsController.current) {
        saveAssignmentsController.current.abort();
        saveAssignmentsController.current = null;
      }
    };
  }, [clearPendingSave]);

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

  const handleCalcDictionarySubmit = (event) => {
    event.preventDefault();
    handleCreateCalcEntry();
  };

  const handleBatchCopy = useCallback(() => {
    if (!isFamilySelected) {
      setStatus({ type: 'error', message: 'Family 항목을 먼저 선택하세요.' });
      return;
    }
    if (!matchingCalcDictionaryEntries.length) {
      setStatus({ type: 'error', message: '복사할 Calc Dictionary 항목이 없습니다.' });
      return;
    }
    const cleaned = matchingCalcDictionaryEntries
      .map((entry) => ({
        symbol_key: String(entry?.symbol_key ?? '').trim(),
        symbol_value: String(entry?.symbol_value ?? '').trim(),
      }))
      .filter((entry) => entry.symbol_key || entry.symbol_value);
    if (!cleaned.length) {
      setStatus({ type: 'error', message: '복사할 데이터가 없습니다.' });
      return;
    }
    setCopiedCalcEntries(cleaned);
    setCopiedFromSequence(cleanedCalcCode);
    setStatus({ type: 'success', message: `${cleaned.length}개 항목을 복사했습니다.` });
  }, [cleanedCalcCode, matchingCalcDictionaryEntries, setStatus, isFamilySelected]);

  const handleBatchPaste = useCallback(async () => {
    if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') {
      setStatus({ type: 'error', message: 'Family 항목을 선택한 다음 붙여넣기 하세요.' });
      return;
    }
    if (!copiedCalcEntries.length) {
      setStatus({ type: 'error', message: '붙여넣을 데이터가 없습니다.' });
      return;
    }
    const targetCalcCode = (selectedFamilyNode.sequence_number ?? '').trim();
    if (!targetCalcCode) {
      setStatus({ type: 'error', message: '선택된 항목에 순번이 있어야 합니다.' });
      return;
    }
    if (targetCalcCode === copiedFromSequence) {
      setStatus({ type: 'error', message: '다른 Family 항목을 선택한 뒤 붙여넣기 하세요.' });
      return;
    }
    setBatchCopyLoading(true);
    try {
      await Promise.all(
        copiedCalcEntries.map((entry) =>
          fetch(`${API_BASE_URL}/family-list/${selectedFamilyNode.id}/calc-dictionary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol_key: entry.symbol_key,
              symbol_value: entry.symbol_value,
              calc_code: targetCalcCode,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              const message =
                body?.detail || body?.message || 'Calc Dictionary 항목을 저장하지 못했습니다.';
              throw new Error(message);
            }
            return response.json().catch(() => null);
          })
        )
      );
      setStatus({ type: 'success', message: '복사된 항목을 붙여넣었습니다.' });
      setNewCalcCodeInput(targetCalcCode);
      await loadCalcDictionary();
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBatchCopyLoading(false);
    }
  }, [
    copiedCalcEntries,
    copiedFromSequence,
    loadCalcDictionary,
    selectedFamilyNode,
    setStatus,
  ]);

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
      const createdItem = await response.json();
      setStatus({ type: 'success', message: '가족 항목이 등록되었습니다.' });
      cancelAdd();
      setPendingFocusNodeId(createdItem?.id ?? null);
      await refreshFamilyItems();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleAddFormSubmit = (event) => {
    event.preventDefault();
    submitCreate();
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
      setPendingFocusNodeId(nodeId);
      await refreshFamilyItems();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleDelete = async (nodeId) => {
    if (!window.confirm('정말 삭제하시겠습니까? 하위 항목도 함께 삭제됩니다.')) return;
    const scrollTargetId = getScrollTargetIdForDeletion(nodeId, filteredItems);
    if (selectedFamilyNode?.id === nodeId) {
      setSelectedFamilyNode(null);
    }
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
      if (scrollTargetId) {
        setPendingScrollNodeId(scrollTargetId);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleFamilySelect = (node) => {
    setSelectedFamilyNode(node);
  };

  const renderAssignedStandardNodes = (nodes, level = 0) => {
    if (!nodes || !nodes.length) return null;
    return nodes.map((node) => {
      const metadata = assignmentMetadata.get(node.id) ?? node.metadata;
      const formulaText = metadata?.formula ?? '';
      const descriptionText = metadata?.description ?? '';
      const isEditing = Boolean(metadata?.id && editingAssignmentId === metadata.id);
      return (
        <div
          key={`assigned-${node.id}-${level}`}
          style={{
            marginLeft: level * 16,
            marginBottom: 10,
            paddingBottom: 4,
            borderBottom: '1px dashed rgba(148, 163, 184, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{node.name}</span>
            <span style={{ fontSize: 11, color: '#475467' }}>({node.type || '표준'})</span>
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, fontSize: 11, color: '#1f2937' }}>
              {formulaText || descriptionText ? (
                <div>
                  {formulaText && (
                    <div style={{ marginBottom: descriptionText ? 4 : 0, fontStyle: 'italic', color: '#0f172a' }}>
                      수식: {formulaText}
                    </div>
                  )}
                  {descriptionText && (
                    <div style={{ color: '#475467', whiteSpace: 'pre-line' }}>{descriptionText}</div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#94a3b8' }}>등록된 수식 / 설명이 없습니다.</div>
              )}
            </div>
            {metadata?.id && (
              <button
                type="button"
                onClick={() => handleStartAssignmentEdit(node)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: '1px solid #cbd5f5',
                  background: isEditing ? '#e0f2fe' : '#fff',
                  cursor: 'pointer',
                }}
              >
                {isEditing ? '편집 중' : '수정'}
              </button>
            )}
          </div>
          {isEditing && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <input
                value={editingAssignmentFields.formula}
                onChange={(event) => handleAssignmentFieldChange('formula', event.target.value)}
                placeholder="수식 입력 (선택)"
                style={{
                  padding: 6,
                  borderRadius: 6,
                  border: '1px solid #cbd5f5',
                  fontSize: 12,
                }}
              />
              <textarea
                rows={2}
                value={editingAssignmentFields.description}
                onChange={(event) => handleAssignmentFieldChange('description', event.target.value)}
                placeholder="설명 입력 (선택)"
                style={{
                  padding: 6,
                  borderRadius: 6,
                  border: '1px solid #cbd5f5',
                  fontSize: 12,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveAssignmentMetadata}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #2563eb',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: 12,
                  }}
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={handleCancelAssignmentEdit}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5f5',
                    background: '#fff',
                    fontSize: 12,
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          {node.children && node.children.length > 0 && renderAssignedStandardNodes(node.children, level + 1)}
        </div>
      );
    });
  };

  const renderFamilyNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isFamily = node.item_type === 'FAMILY';
    const hasSequence = Boolean(isFamily && node.sequence_number);
    const description = node.description?.trim();
    const isSelected = selectedFamilyNode?.id === node.id;
    return (
      <div
        key={node.id}
        data-family-node-id={node.id}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
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
            {level === 0 && (
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
            <form
              onSubmit={handleAddFormSubmit}
              style={{ padding: 12, borderBottom: '1px dashed #cbd5f5', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
            >
              <input
          ref={addNameInputRef}
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
                  type="submit"
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
            </form>
          )}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div
              ref={treeContainerRef}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
            >
              {loading ? (
                <div style={{ color: '#64748b', fontSize: 12 }}>데이터를 불러오는 중입니다...</div>
              ) : familyTree.length > 0 ? (
                familyTree.map((node) => renderFamilyNode(node))
              ) : (
                <div style={{ color: '#64748b', fontSize: 12 }}>등록된 가족 항목이 없습니다.</div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                  {selectedFamilyNode ? `${selectedFamilyNode.name}에 할당된 표준 항목` : '할당된 표준 항목'}
                </div>
                <div style={{ fontSize: 11, color: '#475467' }}>{selectedStdItems.size}개</div>
              </div>
              <div
                style={{
                  maxHeight: 220,
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 12,
                  background: '#f9fafc',
                }}
              >
                {standardTreeError ? (
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>{standardTreeError}</div>
                ) : assignedStandardTree.length > 0 ? (
                  renderAssignedStandardNodes(assignedStandardTree)
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    할당된 표준 항목이 없습니다.
                  </div>
                )}
              </div>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {isFamilySelected && selectedFamilyNode
                  ? `Seq#${selectedFamilyNode.sequence_number || '—'}`
                  : 'Family 항목을 선택하면, 일치하는 calc_code를 보여줍니다.'}
              </div>
              <button
                type="button"
                onClick={handleBatchCopy}
                disabled={!isFamilySelected || !matchingCalcDictionaryEntries.length}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5f5',
                  background: matchingCalcDictionaryEntries.length ? '#e2e8f0' : '#f1f5f9',
                  color: '#0f172a',
                  fontSize: 11,
                  cursor: matchingCalcDictionaryEntries.length ? 'pointer' : 'not-allowed',
                }}
              >
                일괄 복사
              </button>
              <button
                type="button"
                onClick={handleBatchPaste}
                disabled={
                  !copiedCalcEntries.length ||
                  !isFamilySelected ||
                  !selectedFamilyNode?.sequence_number?.trim() ||
                  selectedFamilyNode?.sequence_number?.trim() === copiedFromSequence ||
                  batchCopyLoading
                }
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #2563eb',
                  background:
                    !copiedCalcEntries.length ||
                    !isFamilySelected ||
                    !selectedFamilyNode?.sequence_number?.trim() ||
                    selectedFamilyNode?.sequence_number?.trim() === copiedFromSequence ||
                    batchCopyLoading
                      ? '#e2e8f0'
                      : '#2563eb',
                  color:
                    !copiedCalcEntries.length ||
                    !isFamilySelected ||
                    !selectedFamilyNode?.sequence_number?.trim() ||
                    selectedFamilyNode?.sequence_number?.trim() === copiedFromSequence ||
                    batchCopyLoading
                      ? '#94a3b8'
                      : '#fff',
                  fontSize: 11,
                  cursor:
                    !copiedCalcEntries.length ||
                    !isFamilySelected ||
                    !selectedFamilyNode?.sequence_number?.trim() ||
                    selectedFamilyNode?.sequence_number?.trim() === copiedFromSequence ||
                    batchCopyLoading
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                붙여넣기
              </button>
              {copiedCalcEntries.length > 0 && (
                <span style={{ fontSize: 11 }}>{copiedCalcEntries.length}개 복사됨</span>
              )}
            </div>
          </div>
          {isFamilySelected && (
            <form
              onSubmit={handleCalcDictionarySubmit}
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
                type="submit"
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
            </form>
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
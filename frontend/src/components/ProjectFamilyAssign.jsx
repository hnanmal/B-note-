import React, { useEffect, useMemo, useState } from 'react';
import ProjectFamilyListWidget from './ProjectFamilyListWidget';
import {
  formatCartTimestamp,
  persistWorkMasterCartEntries,
  readWorkMasterCartEntries,
} from '../utils/workMasterCart';

const WORK_MASTER_COLUMNS = ['Use', 'GWM', 'Item', '상세', '단위'];

const normalizeCartEntry = (entry) => ({
  id: entry?.id ?? `cart-${Date.now()}`,
  revitTypes: entry?.revitTypes ?? entry?.revit_types ?? [],
  assignmentIds: entry?.assignmentIds ?? entry?.assignment_ids ?? [],
  standardItemIds: entry?.standardItemIds ?? entry?.standard_item_ids ?? [],
  createdAt: entry?.createdAt ?? entry?.created_at ?? new Date().toISOString(),
});

export default function ProjectFamilyAssign({ apiBaseUrl }) {
  const [buildings, setBuildings] = useState([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [revitTypeInput, setRevitTypeInput] = useState('');
  const [activeRevitIndex, setActiveRevitIndex] = useState(0);
  const [savedRevitTypeEntries, setSavedRevitTypeEntries] = useState([]);
  const [selectedRevitIndexes, setSelectedRevitIndexes] = useState([]);
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [revitTypesLoading, setRevitTypesLoading] = useState(false);
  const [revitTypesError, setRevitTypesError] = useState(null);
  const [revitTypesSaving, setRevitTypesSaving] = useState(false);
  const [revitTypesSaveError, setRevitTypesSaveError] = useState(null);
  const [calcDictEntries, setCalcDictEntries] = useState([]);
  const [calcDictLoading, setCalcDictLoading] = useState(false);
  const [calcDictError, setCalcDictError] = useState(null);
  const [familyAssignments, setFamilyAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);
  const [savedCartEntries, setSavedCartEntries] = useState([]);
  const [cartStatusMessage, setCartStatusMessage] = useState('');
  const [standardItemWorkMasters, setStandardItemWorkMasters] = useState({});

  useEffect(() => {
    setSavedCartEntries(readWorkMasterCartEntries());
  }, []);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/workmaster-cart`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const normalized = Array.isArray(data) ? data.map(normalizeCartEntry) : [];
        setSavedCartEntries((prev) => {
          if (!normalized.length) return prev;
          const seen = new Set();
          const merged = [...normalized, ...prev];
          const unique = [];
          merged.forEach((entry) => {
            const key = entry?.id;
            if (key == null || seen.has(key)) return;
            seen.add(key);
            unique.push(entry);
          });
          return unique;
        });
      } catch (error) {
        // ignore fetch failure; keep local cart
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    persistWorkMasterCartEntries(savedCartEntries);
  }, [savedCartEntries]);

  const collectSubtreeAssignmentIds = (node, includeSelf = true) => {
    const ids = [];
    const initialChildren = Array.isArray(node?.children) ? node.children : [];
    const stack = includeSelf ? [node] : [...initialChildren];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      if (current.id != null) {
        ids.push(current.id);
      }
      if (Array.isArray(current.children)) {
        current.children.forEach((child) => stack.push(child));
      }
    }
    return ids;
  };

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    setLoadingBuildings(true);
    fetch(`${apiBaseUrl}/building-list/`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setBuildings(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length) {
          setSelectedBuilding((prev) => prev ?? data[0]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBuildings([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBuildings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl || !selectedFamily?.id) {
      setCalcDictEntries([]);
      setCalcDictError(null);
      setCalcDictLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCalcDictLoading(true);
    setCalcDictError(null);
    fetch(`${apiBaseUrl}/family-list/${selectedFamily.id}/calc-dictionary`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Calc Dictionary를 불러오지 못했습니다.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCalcDictEntries(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (cancelled) return;
        setCalcDictError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
        setCalcDictEntries([]);
      })
      .finally(() => {
        if (!cancelled) setCalcDictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, selectedFamily?.id]);

  useEffect(() => {
    if (!apiBaseUrl || !selectedFamily?.id) {
      setFamilyAssignments([]);
      setAssignmentsLoading(false);
      setAssignmentsError(null);
      return undefined;
    }
    let cancelled = false;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    fetch(`${apiBaseUrl}/family-list/${selectedFamily.id}/assignments`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('할당된 Work Master를 불러오지 못했습니다.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setFamilyAssignments(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (cancelled) return;
        setAssignmentsError(
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        );
        setFamilyAssignments([]);
      })
      .finally(() => {
        if (!cancelled) {
          setAssignmentsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, selectedFamily?.id]);

  useEffect(() => {
    if (!apiBaseUrl || !familyAssignments.length) {
      setStandardItemWorkMasters({});
      return undefined;
    }
    const ids = Array.from(
      new Set(
        familyAssignments
          .map((assignment) => assignment?.standard_item?.id)
          .filter((id) => Number.isFinite(id))
      )
    );
    if (!ids.length) {
      setStandardItemWorkMasters({});
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const res = await fetch(`${apiBaseUrl}/standard-items/${id}`);
              if (!res.ok) throw new Error('failed');
              const data = await res.json();
              let selectedWorkMaster = null;
              const selectedId = data?.selected_work_master_id;
              if (selectedId) {
                try {
                  const wmRes = await fetch(`${apiBaseUrl}/work-masters/${selectedId}`);
                  if (wmRes.ok) {
                    selectedWorkMaster = await wmRes.json();
                  }
                } catch (error) {
                  // ignore fetch error, keep null
                }
              }
              return [id, { standardItem: data, selectedWorkMaster }];
            } catch (error) {
              return [id, null];
            }
          })
        );
        if (cancelled) return;
        const map = {};
        results.forEach(([id, payload]) => {
          if (payload) {
            map[id] = payload;
          }
        });
        setStandardItemWorkMasters(map);
      } catch (error) {
        if (!cancelled) {
          setStandardItemWorkMasters({});
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, familyAssignments]);

    useEffect(() => {
      if (!apiBaseUrl || !selectedFamily?.id) {
        setSavedRevitTypeEntries([]);
        setRevitTypesLoading(false);
        setRevitTypesError(null);
        return undefined;
      }
      let cancelled = false;
      setRevitTypesLoading(true);
      setRevitTypesError(null);
      setRevitTypesSaveError(null);
      fetch(`${apiBaseUrl}/family-list/${selectedFamily.id}/revit-types`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Revit 타입을 불러오지 못했습니다.');
          }
          return res.json();
        })
        .then((payload) => {
          if (cancelled) return;
          if (Array.isArray(payload)) {
            setSavedRevitTypeEntries(payload.filter(Boolean));
          } else {
            setSavedRevitTypeEntries([]);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setRevitTypesError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
          setSavedRevitTypeEntries([]);
        })
        .finally(() => {
          if (!cancelled) setRevitTypesLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [apiBaseUrl, selectedFamily?.id]);

  const revitTypeRows = useMemo(
    () =>
      revitTypeInput
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter((row) => row),
    [revitTypeInput]
  );

  const displayedRevitEntries = savedRevitTypeEntries;

  const activeRevitIndexClamped = displayedRevitEntries.length
    ? Math.min(activeRevitIndex, displayedRevitEntries.length - 1)
    : 0;
  const activeRevitType = displayedRevitEntries[activeRevitIndexClamped]?.type_name;
  const selectedRevitIndexSet = useMemo(() => new Set(selectedRevitIndexes), [
    selectedRevitIndexes,
  ]);

  const currentSelectedRevitTypes = useMemo(() => {
    const names = selectedRevitIndexes.length
      ? Array.from(new Set(
          selectedRevitIndexes
            .map((index) => displayedRevitEntries[index]?.type_name)
            .filter(Boolean)
        ))
      : activeRevitType
        ? [activeRevitType]
        : [];
    return names;
  }, [selectedRevitIndexes, displayedRevitEntries, activeRevitType]);


  useEffect(() => {
    setActiveRevitIndex((prev) => {
      if (!displayedRevitEntries.length) {
        return prev === 0 ? prev : 0;
      }
      if (prev >= displayedRevitEntries.length) {
        return displayedRevitEntries.length - 1;
      }
      return prev;
    });
    setSelectedRevitIndexes((prev) => {
      const filtered = prev.filter((index) => index >= 0 && index < displayedRevitEntries.length);
      const unchanged = filtered.length === prev.length && filtered.every((value, idx) => value === prev[idx]);
      return unchanged ? prev : filtered;
    });
    setSelectionAnchor((prev) => {
      if (prev === null) return prev;
      if (prev >= displayedRevitEntries.length) {
        return null;
      }
      return prev;
    });
  }, [displayedRevitEntries.length]);

  const handleMoveActiveRevit = (delta) => {
    if (!displayedRevitEntries.length) return;
    setActiveRevitIndex((prev) => {
      const next = Math.max(0, Math.min(displayedRevitEntries.length - 1, prev + delta));
      setSelectedRevitIndexes([next]);
      setSelectionAnchor(next);
      return next;
    });
  };

  const handleAssignmentCheckboxToggle = (assignmentId) => {
    setSelectedAssignmentIds((prev) => {
      if (prev.includes(assignmentId)) {
        return prev.filter((id) => id !== assignmentId);
      }
      return [...prev, assignmentId];
    });
  };

  const handleParentLabelCheckboxToggle = (row) => {
    const uniqueIds = Array.from(new Set(collectSubtreeAssignmentIds(row, false)));
    if (!uniqueIds.length) return;
    setSelectedAssignmentIds((prev) => {
      const allSelected = uniqueIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !uniqueIds.includes(id));
      }
      const next = [...prev];
      uniqueIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const handleSaveAssignmentCart = async () => {
    if (!selectedAssignmentIds.length) {
      setCartStatusMessage('선택된 Work Master 항목이 없습니다.');
      return;
    }
    if (!currentSelectedRevitTypes.length) {
      setCartStatusMessage('저장할 Revit 타입을 선택하세요.');
      return;
    }
    const optimisticId = `cart-${Date.now()}`;
    const newEntry = {
      id: optimisticId,
      revitTypes: currentSelectedRevitTypes,
      assignmentIds: [...selectedAssignmentIds],
      standardItemIds: Array.from(
        new Set(
          selectedAssignmentIds
            .map((assignmentId) => assignmentRowMap.get(assignmentId)?.standardItemId)
            .filter(Boolean)
        )
      ),
      createdAt: new Date().toISOString(),
    };
    setSavedCartEntries((prev) => [newEntry, ...prev]);
    setCartStatusMessage('장바구니 저장 중...');

    if (!apiBaseUrl) {
      setCartStatusMessage('장바구니를 로컬에 저장했습니다.');
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/workmaster-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revit_types: newEntry.revitTypes,
          assignment_ids: newEntry.assignmentIds,
          standard_item_ids: newEntry.standardItemIds,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const payload = await res.json();
      const saved = normalizeCartEntry(payload);
      setSavedCartEntries((prev) => [saved, ...prev.filter((entry) => entry.id !== optimisticId)]);
      setCartStatusMessage('장바구니에 저장되었습니다.');
    } catch (error) {
      setCartStatusMessage('장바구니를 로컬에만 저장했습니다. 다시 시도하세요.');
    }
  };

  const handleRevitEntryClick = (index, event) => {
    if (!displayedRevitEntries.length) return;
    const shiftHeld = event.shiftKey;
    const ctrlHeld = event.ctrlKey || event.metaKey;
    setActiveRevitIndex(index);
    if (shiftHeld) {
      const anchorIndex = selectionAnchor ?? activeRevitIndexClamped;
      const start = Math.min(anchorIndex, index);
      const end = Math.max(anchorIndex, index);
      const range = [];
      for (let i = start; i <= end; i += 1) {
        range.push(i);
      }
      setSelectedRevitIndexes(range);
    } else if (ctrlHeld) {
      setSelectedRevitIndexes((prev) => {
        if (prev.includes(index)) {
          return prev.filter((value) => value !== index);
        }
        return [...prev, index].sort((a, b) => a - b);
      });
    } else {
      setSelectedRevitIndexes([index]);
    }
    setSelectionAnchor(index);
  };

  const handleSaveRevitTypes = () => {
    if (!apiBaseUrl || !selectedFamily?.id) return;
    const typeNames = revitTypeRows;
    if (!typeNames.length) {
      setRevitTypesSaveError('한 줄에 하나씩 Revit 타입을 입력한 후 ↓ 버튼을 눌러 저장하세요.');
      return;
    }
    const existingTypeNames = savedRevitTypeEntries.map((entry) => entry.type_name).filter(Boolean);
    const combinedTypeNames = [...existingTypeNames];
    typeNames.forEach((name) => {
      if (!combinedTypeNames.includes(name)) {
        combinedTypeNames.push(name);
      }
    });
    setRevitTypesSaving(true);
    setRevitTypesSaveError(null);
    fetch(`${apiBaseUrl}/family-list/${selectedFamily.id}/revit-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_names: combinedTypeNames }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Revit 타입을 저장하지 못했습니다.');
        }
        return res.json();
      })
      .then((payload) => {
        const entries = Array.isArray(payload) ? payload.filter(Boolean) : [];
        setSavedRevitTypeEntries(entries);
        setActiveRevitIndex(0);
        setSelectedRevitIndexes([]);
        setSelectionAnchor(null);
        setRevitTypeInput('');
      })
      .catch((error) => {
        setRevitTypesSaveError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      })
      .finally(() => {
        setRevitTypesSaving(false);
      });
  };

  const handleRemoveActiveRevit = () => {
    if (!apiBaseUrl || !selectedFamily?.id) return;
    if (!displayedRevitEntries.length) {
      return;
    }
    const normalizedIndexes = selectedRevitIndexes.length
      ? Array.from(new Set(selectedRevitIndexes))
          .sort((a, b) => a - b)
          .filter((index) => index >= 0 && index < displayedRevitEntries.length)
      : [];
    const targetIndexes = normalizedIndexes.length
      ? normalizedIndexes
      : [activeRevitIndexClamped].filter((index) => index >= 0);
    if (!targetIndexes.length) return;
    const removalSet = new Set(targetIndexes);
    const remainingTypeNames = savedRevitTypeEntries
      .filter((_, index) => !removalSet.has(index))
      .map((entry) => entry.type_name);
    const removedEntries = targetIndexes
      .map((index) => displayedRevitEntries[index])
      .filter(Boolean);
    setRevitTypesSaving(true);
    setRevitTypesSaveError(null);
    fetch(`${apiBaseUrl}/family-list/${selectedFamily.id}/revit-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_names: remainingTypeNames }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Revit 타입을 삭제하지 못했습니다.');
        }
        return res.json();
      })
      .then((payload) => {
        const entries = Array.isArray(payload) ? payload.filter(Boolean) : [];
        setSavedRevitTypeEntries(entries);
        const nextFocusIndex = entries.length
          ? Math.min(targetIndexes[0], entries.length - 1)
          : 0;
        setActiveRevitIndex(entries.length ? nextFocusIndex : 0);
        setSelectionAnchor(entries.length ? nextFocusIndex : null);
        setSelectedRevitIndexes([]);
        if (removedEntries.length) {
          const removedText = removedEntries
            .map((entry) => entry.type_name)
            .filter(Boolean)
            .join('\n');
          if (removedText) {
            setRevitTypeInput((prev) => (prev ? `${removedText}\n${prev}` : removedText));
          }
        }
      })
      .catch((error) => {
        setRevitTypesSaveError(
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        );
      })
      .finally(() => {
        setRevitTypesSaving(false);
      });
  };

  const handleRevitTextareaKeyDown = (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      return;
    }
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      handleSaveRevitTypes();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      handleRemoveActiveRevit();
    }
  };
 
  const familyLabel = selectedFamily?.name ?? '패밀리를 선택하세요';
  const familySequence = selectedFamily?.sequence_number ?? '–';
  const buildingLabel = selectedBuilding?.name ?? '건물을 선택하세요';
  const assignmentGroups = useMemo(
    () => ({
      GWM: familyAssignments.filter((assignment) => assignment?.standard_item?.type === 'GWM'),
      SWM: familyAssignments.filter((assignment) => assignment?.standard_item?.type === 'SWM'),
    }),
    [familyAssignments]
  );

  const assignmentRowsByType = useMemo(() => {
    const buildRows = (assignments) => {
      const rows = [];
      const rowByItemId = new Map();
      assignments.forEach((assignment) => {
        const detailParts = [];
        if (assignment.formula) {
          detailParts.push(`수식: ${assignment.formula}`);
        }
        if (assignment.description) {
          detailParts.push(assignment.description);
        }
        const row = {
          id: assignment.id,
          use: '●',
          discipline: assignment.standard_item?.type ?? '—',
          item: assignment.standard_item?.name ?? 'Unnamed',
          detail: detailParts.length ? detailParts.join(' · ') : '—',
          unit: 'EA',
          standardItemId: assignment.standard_item?.id,
          parentId: assignment.standard_item?.parent_id,
          children: [],
        };
        rows.push(row);
        if (row.standardItemId) {
          rowByItemId.set(row.standardItemId, row);
        }
      });

      rows.forEach((row) => {
        const parent = row.parentId ? rowByItemId.get(row.parentId) : undefined;
        if (parent && parent !== row) {
          parent.children.push(row);
        }
      });

      rows.forEach((row) => {
        row.hasChildren = Boolean(row.children.length);
      });

      const isRoot = (row) => {
        if (!row.parentId) return true;
        const parent = rowByItemId.get(row.parentId);
        return !parent;
      };

      const sortByItem = (a, b) => (a.item ?? '').localeCompare(b.item ?? '');
      const flattenedRows = [];

      const traverseNode = (node, depth = 0) => {
        flattenedRows.push({ ...node, depth });
        node.children.sort(sortByItem).forEach((child) => traverseNode(child, depth + 1));
      };

      rows.filter(isRoot).sort(sortByItem).forEach((root) => traverseNode(root, 0));
      return flattenedRows;
    };

    return {
      GWM: buildRows(assignmentGroups.GWM),
      SWM: buildRows(assignmentGroups.SWM),
    };
  }, [assignmentGroups]);

  const assignmentRowMap = useMemo(() => {
    const map = new Map();
    Object.values(assignmentRowsByType).forEach((rows) => {
      rows.forEach((row) => {
        if (row?.id != null) {
          map.set(row.id, row);
        }
      });
    });
    return map;
  }, [assignmentRowsByType]);

  const assignmentById = useMemo(() => {
    const map = new Map();
    familyAssignments.forEach((assignment) => {
      if (assignment?.id != null) {
        map.set(assignment.id, assignment);
      }
    });
    return map;
  }, [familyAssignments]);

  const standardItemById = useMemo(() => {
    const map = new Map();
    familyAssignments.forEach((assignment) => {
      const standardItem = assignment?.standard_item;
      if (standardItem?.id != null) {
        map.set(standardItem.id, standardItem);
      }
    });
    return map;
  }, [familyAssignments]);

  const buildItemPath = (standardItem) => {
    if (!standardItem) return '—';
    const level2 = standardItem.name ?? '—';
    if (!standardItem.parent_id) return level2;
    const parent = standardItemById.get(standardItem.parent_id);
    const level1 = parent?.name;
    const parts = [level1, level2].filter(Boolean);
    return parts.length ? parts.join(' | ') : level2;
  };

  const buildWorkMasterSummary = (workMaster) => {
    if (!workMaster) return '—';
    const parts = [
      workMaster.work_master_code,
      workMaster.cat_large_desc,
      workMaster.cat_mid_desc,
      workMaster.cat_small_desc,
      workMaster.work_group_code,
      workMaster.discipline,
    ].filter(Boolean);
    return parts.length ? parts.join(' | ') : '—';
  };

  const buildUnitLabel = (workMaster) => {
    if (!workMaster) return '—';
    const parts = [workMaster.uom1, workMaster.uom2].filter(Boolean);
    return parts.length ? parts.join(' / ') : '—';
  };

  const resolveWorkMaster = (assignment) => {
    if (assignment?.work_master) return assignment.work_master;

    const std = assignment?.standard_item;
    const stdSelectedId = std?.selected_work_master_id;

    if (std && Array.isArray(std.work_masters) && std.work_masters.length) {
      if (stdSelectedId) {
        const match = std.work_masters.find((wm) => wm.id === stdSelectedId);
        if (match) return match;
      }
      return std.work_masters[0];
    }

    const stdId = std?.id;
    if (!stdId) return null;
    const entry = standardItemWorkMasters[stdId];
    const detail = entry?.standardItem;
    const selectedWorkMaster = entry?.selectedWorkMaster;
    if (selectedWorkMaster) return selectedWorkMaster;
    if (detail && Array.isArray(detail.work_masters) && detail.work_masters.length) {
      const selectedId = detail.selected_work_master_id || stdSelectedId;
      if (selectedId) {
        const match = detail.work_masters.find((wm) => wm.id === selectedId);
        if (match) return match;
      }
      return detail.work_masters[0];
    }
    return null;
  };

  const visibleCartEntries = useMemo(() => {
    if (!currentSelectedRevitTypes.length) return [];
    const selectedSet = new Set(currentSelectedRevitTypes);
    return savedCartEntries.filter((entry) =>
      Array.isArray(entry?.revitTypes) && entry.revitTypes.some((name) => selectedSet.has(name))
    );
  }, [currentSelectedRevitTypes, savedCartEntries]);

  const cartTableRows = useMemo(() => {
    const rows = [];
    visibleCartEntries.forEach((entry) => {
      const assignments = (entry.assignmentIds || [])
        .map((id) => assignmentById.get(id))
        .filter(Boolean);
      if (!assignments.length) {
        rows.push({
          id: `${entry.id}-empty`,
          revitTypesLabel: entry.revitTypes.join(', '),
          createdAt: entry.createdAt,
          type: '—',
          itemPath: 'Work Master 정보를 불러올 수 없습니다.',
          workMasterSummary: '—',
          gauge: '—',
          spec: '—',
          formula: '—',
          unit: '—',
          outputType: selectedFamily?.sequence_number ?? '—',
        });
        return;
      }
      assignments.forEach((assignment) => {
        const standardItem = assignment?.standard_item;
        const workMaster = resolveWorkMaster(assignment);
        rows.push({
          id: `${entry.id}-${assignment.id}`,
          revitTypesLabel: entry.revitTypes.join(', '),
          createdAt: entry.createdAt,
          type: standardItem?.type ?? '—',
          itemPath: buildItemPath(standardItem),
          workMasterSummary: buildWorkMasterSummary(workMaster),
          gauge: (workMaster?.gauge ?? '').toUpperCase() || '—',
          spec: workMaster?.add_spec ?? '—',
          formula: assignment.formula ?? '—',
          unit: buildUnitLabel(workMaster),
          outputType: selectedFamily?.sequence_number ?? '—',
        });
      });
    });
    return rows;
  }, [visibleCartEntries, assignmentById, selectedFamily?.sequence_number, standardItemWorkMasters]);

  const renderAssignmentCard = (title, typeKey) => {
    const assignments = assignmentGroups[typeKey];
    return (
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 12,
          background: '#fdfdfd',
          minHeight: 140,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{title}</div>
        {assignmentsLoading ? (
          <div style={{ fontSize: 12, color: '#475467' }}>로딩 중...</div>
        ) : assignmentsError ? (
          <div style={{ fontSize: 12, color: '#dc2626' }}>{assignmentsError}</div>
        ) : !assignments.length ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>할당된 항목이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignments.map((assignment) => (
              <div key={assignment.id}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                  {assignment.standard_item?.name ?? 'Unnamed'}
                </div>
                {assignment.formula && (
                  <div style={{ fontSize: 11, color: '#2563eb' }}>수식: {assignment.formula}</div>
                )}
                {assignment.description && (
                  <div style={{ fontSize: 11, color: '#475467' }}>{assignment.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderWorkMasterColumn = (typeKey, title) => {
    const rows = assignmentRowsByType[typeKey] ?? [];
    const emptyMessage = selectedFamily
      ? `${typeKey} 패밀리에 할당된 Work Master가 없습니다.`
      : '패밀리를 선택하면 목록이 여기에 표시됩니다.';
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: '#fff',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{title}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 100px 80px 40px',
            fontSize: 11,
            color: '#475467',
          }}
        >
          {WORK_MASTER_COLUMNS.map((col) => (
            <span key={`${typeKey}-${col}`} style={{ fontWeight: 600 }}>{col}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {assignmentsLoading ? (
            <div style={{ fontSize: 12, color: '#475467' }}>할당된 항목을 불러오는 중입니다...</div>
          ) : assignmentsError ? (
            <div style={{ fontSize: 12, color: '#dc2626' }}>{assignmentsError}</div>
          ) : !rows.length ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{emptyMessage}</div>
          ) : (
            rows.map((row) => {
              const depth = row.depth ?? 0;
              const isParentLabel = Boolean(row.hasChildren);
              if (isParentLabel) {
                const showLabelCheckbox = typeKey === 'GWM';
                const labelIds = showLabelCheckbox
                  ? Array.from(new Set(collectSubtreeAssignmentIds(row, false)))
                  : [];
                const allLabelSelected = showLabelCheckbox && labelIds.length
                  ? labelIds.every((id) => selectedAssignmentIds.includes(id))
                  : false;
                return (
                  <div
                    key={`label-${row.id}`}
                    onClick={showLabelCheckbox ? () => handleParentLabelCheckboxToggle(row) : undefined}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '6px 0',
                      borderBottom: '1px solid #e5e7eb',
                      background: '#f1f5f9',
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 100px 80px 40px',
                      alignItems: 'center',
                      paddingLeft: 0,
                      cursor: showLabelCheckbox ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {showLabelCheckbox && (
                        <input
                          type="checkbox"
                          checked={allLabelSelected}
                          onChange={() => handleParentLabelCheckboxToggle(row)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Use ${row.item} group`}
                          style={{ width: 16, height: 16 }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        gridColumn: '2 / span 1',
                        paddingLeft: depth * 10,
                      }}
                    >
                      {row.item}
                    </span>
                    <span style={{ fontSize: 10, color: '#475467' }}>{row.discipline}</span>
                    <span />
                    <span />
                  </div>
                );
              }
              const isSelected = selectedAssignmentIds.includes(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => handleAssignmentCheckboxToggle(row.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 100px 80px 40px',
                    fontSize: 10,
                    borderBottom: '1px solid #e5e7eb',
                    padding: '4px 0',
                    background: isSelected ? '#e0f2fe' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleAssignmentCheckboxToggle(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Use ${row.item}`}
                      style={{ width: 16, height: 16 }}
                    />
                  </span>
                  <span>{row.discipline}</span>
                  <span style={{ paddingLeft: depth > 0 ? depth * 10 : 0, fontWeight: depth === 0 ? 600 : 400 }}>
                    {row.item}
                  </span>
                  <span>{row.detail}</span>
                  <span>{row.unit}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 24,
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          flex: '0 0 320px',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          boxShadow: '0 10px 40px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Family List</div>
        <div style={{ flex: 1, minHeight: 400 }}>
          <ProjectFamilyListWidget
            apiBaseUrl={apiBaseUrl}
            selectedFamilyId={selectedFamily?.id}
            onFamilySelect={setSelectedFamily}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 16,
          background: '#fff',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 10px 40px rgba(15,23,42,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 12,
            background: '#fbfbff',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Select Building</div>
          <select
            value={selectedBuilding?.id ?? ''}
            onChange={(event) => {
              const selectedId = Number(event.target.value);
              const match = buildings.find((building) => building.id === selectedId);
              if (match) setSelectedBuilding(match);
            }}
            style={{
              borderRadius: 8,
              border: '1px solid #d1d5db',
              padding: '6px 10px',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value="" disabled>
              {loadingBuildings ? '건물 목록을 불러오는 중입니다...' : '건물을 선택하세요'}
            </option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 16,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 16px rgba(15,23,42,0.05)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Enter Revit Type</div>
          <textarea
            rows={3}
            value={revitTypeInput}
            onChange={(event) => {
              setRevitTypeInput(event.target.value);
              setRevitTypesSaveError(null);
            }}
            onKeyDown={handleRevitTextareaKeyDown}
            placeholder="Revit에서 모델링한 타입 이름을 줄 단위로 입력하세요."
            style={{
              borderRadius: 12,
              border: '1px solid #d1d5db',
              padding: 10,
              fontSize: 12,
              minHeight: 96,
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 11, color: '#475467', lineHeight: 1.4 }}>
            &lt;S&gt; 키를 눌러 장바구니를 동일한 항목으로 일괄 지정하세요.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSaveRevitTypes}
              style={{
                width: 40,
                height: 38,
                borderRadius: 12,
                border: '1px solid #2563eb',
                background: '#2563eb',
                fontWeight: 700,
                color: '#fff',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="입력된 Revit 타입을 줄 단위로 분리하여 저장합니다"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={handleRemoveActiveRevit}
              disabled={!savedRevitTypeEntries.length}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid #cbd5f5',
                background: savedRevitTypeEntries.length ? '#fff' : '#f1f5f9',
                fontWeight: 600,
                color: savedRevitTypeEntries.length ? '#0f172a' : '#94a3b8',
                fontSize: 14,
                cursor: savedRevitTypeEntries.length ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="선택 항목을 제거하고 다시 텍스트 입력창으로 올립니다"
            >
              ↑
            </button>
            <span style={{ fontSize: 12, color: '#2563eb', flex: 1 }}>
              {activeRevitType ? `현재 활성 타입: ${activeRevitType}` : '선택된 Revit 타입이 없습니다.'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleMoveActiveRevit(-1)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #cbd5f5',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="이전 항목 선택"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => handleMoveActiveRevit(1)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #cbd5f5',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="다음 항목 선택"
              >
                ▼
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: revitTypesSaveError ? '#dc2626' : '#475467' }}>
            {revitTypesSaving
              ? 'Revit 타입을 저장하는 중입니다...'
              : revitTypesSaveError
                ? revitTypesSaveError
                : '↓ 버튼으로 입력한 Revit 타입을 줄 단위로 저장합니다.'}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              fontSize: 11,
              color: '#475467',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontWeight: 600 }}>Revit Type</span>
            <span style={{ fontWeight: 600 }}>Building</span>
            <span style={{ fontWeight: 600 }}>Std</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {revitTypesLoading ? (
              <div style={{ fontSize: 12, color: '#475467' }}>저장된 Revit 타입을 불러오고 있습니다...</div>
            ) : revitTypesError ? (
              <div style={{ fontSize: 12, color: '#dc2626' }}>{revitTypesError}</div>
            ) : displayedRevitEntries.length ? (
              displayedRevitEntries.map((entry, index) => {
                const isActive = index === activeRevitIndexClamped;
                const isSelected = selectedRevitIndexSet.has(index);
                return (
                  <div
                    key={entry.id ?? `${entry.type_name}-${index}`}
                    onClick={(event) => handleRevitEntryClick(index, event)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      padding: '6px 8px',
                      borderRadius: 10,
                      background: isActive
                        ? '#dbeafe'
                        : isSelected
                          ? '#eff6ff'
                          : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#0f172a' }}>{entry.type_name}</span>
                    <span style={{ fontSize: 12 }}>{buildingLabel}</span>
                    <span style={{ fontSize: 12 }}>{familySequence}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>입력된 Revit 타입이 없습니다.</div>
            )}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            minHeight: 160,
            padding: 12,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Calc Dictionary</div>
          {calcDictLoading ? (
            <div style={{ fontSize: 12, color: '#475467' }}>Calc Dictionary를 불러오는 중입니다...</div>
          ) : calcDictError ? (
            <div style={{ fontSize: 12, color: '#dc2626' }}>{calcDictError}</div>
          ) : !calcDictEntries.length ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {selectedFamily
                ? '이 패밀리에 대응하는 Calc Dictionary 항목이 없습니다.'
                : '패밀리를 선택하면 Calc Dictionary 항목이 나타납니다.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 2fr',
                gap: 8,
                fontSize: 11,
                color: '#475467',
              }}
            >
              <span style={{ fontWeight: 600 }}>Calc Code</span>
              <span style={{ fontWeight: 600 }}>Symbol</span>
              <span style={{ fontWeight: 600 }}>Value</span>
              {calcDictEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <span style={{ fontSize: 12, color: '#0f172a' }}>{entry.calc_code ?? '—'}</span>
                  <span style={{ fontSize: 12 }}>{entry.symbol_key}</span>
                  <span style={{ fontSize: 12 }}>{entry.symbol_value}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            style={{
              width: 40,
              height: 38,
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              background: '#fff',
              fontWeight: 700,
              color: '#0f172a',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ↑
          </button>
          <button
            type="button"
            style={{
              width: 40,
              height: 38,
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              background: '#fff',
              fontWeight: 700,
              color: '#0f172a',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ↓
          </button>
          <span style={{ fontSize: 12, color: '#475467' }}>
            윗/아랫 방향 버튼을 눌러 작업 대상 건물 순번을 조정하세요.
          </span>
        </div>
        <button
          type="button"
          style={{
            borderRadius: 12,
            border: 'none',
            padding: '10px 16px',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            width: 'fit-content',
          }}
        >
          Update from common-input
        </button>
        <div style={{ fontSize: 12, color: '#475467' }}>Matched WMs for Selected Standard Types</div>
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 12,
            background: '#fff',
            minHeight: 120,
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          자동 매칭 결과가 없습니다.
        </div>
        <div
          style={{
            borderRadius: 16,
            border: '1px solid #e0f2fe',
            padding: 16,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>할당된 Work Master</div>
            <span style={{ fontSize: 11, color: '#475467' }}>
              {selectedFamily ? '선택된 패밀리 기준' : '패밀리를 선택하면 목록이 나타납니다.'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {renderAssignmentCard('GWM', 'GWM')}
            {renderAssignmentCard('SWM', 'SWM')}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: '0 0 720px',
          background: '#fff',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#0f172a',
            fontWeight: 700,
            paddingBottom: 4,
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          Work Master 메뉴
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            minHeight: 360,
          }}
        >
          {renderWorkMasterColumn('GWM', 'GWM')}
          {renderWorkMasterColumn('SWM', 'SWM')}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={handleSaveAssignmentCart}
            disabled={!selectedAssignmentIds.length || !currentSelectedRevitTypes.length}
            style={{
              flex: '0 0 auto',
              borderRadius: 12,
              border: '1px solid #2563eb',
              background: selectedAssignmentIds.length && currentSelectedRevitTypes.length ? '#2563eb' : '#cbd5f5',
              color: '#fff',
              fontWeight: 600,
              padding: '10px 20px',
              cursor: selectedAssignmentIds.length && currentSelectedRevitTypes.length ? 'pointer' : 'not-allowed',
            }}
          >
            장바구니 저장
          </button>
          <span style={{ fontSize: 11, color: '#475467', flex: 1 }}>
            {cartStatusMessage || '선택한 Revit 타입과 Work Master를 장바구니로 저장합니다.'}
          </span>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #dae1f3',
            background: '#f8fafc',
            minHeight: 160,
            maxHeight: 260,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <div
            style={{
              borderRadius: '10px 10px 0 0',
              background: '#7c3aed',
              padding: '8px 12px',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Work Master 장바구니 👜</span>
            <span style={{ flex: 1 }} />
            <span>
              {currentSelectedRevitTypes.length
                ? `${currentSelectedRevitTypes.join(', ')} 기준`
                : 'Revit 타입을 선택하세요'}
            </span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cartTableRows.length ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 64px 1fr 1.4fr 70px 140px 120px 80px 90px 120px',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: 6,
                  }}
                >
                  <span>Revit Type</span>
                  <span>분류</span>
                  <span>Item</span>
                  <span>Work Master</span>
                  <span>Gauge</span>
                  <span>Spec</span>
                  <span>수식</span>
                  <span>단위</span>
                  <span>산출유형</span>
                  <span>저장시각</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cartTableRows.map((row, index) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 64px 1fr 1.4fr 70px 140px 120px 80px 90px 120px',
                        gap: 6,
                        fontSize: 11,
                        color: '#0f172a',
                        background: index % 2 === 0 ? '#f8fafc' : '#fff',
                        padding: '6px 4px',
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{row.revitTypesLabel}</span>
                      <span>{row.type}</span>
                      <span>{row.itemPath}</span>
                      <span>{row.workMasterSummary}</span>
                      <span>{row.gauge}</span>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{row.spec}</span>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{row.formula}</span>
                      <span>{row.unit}</span>
                      <span>{row.outputType}</span>
                      <span>{formatCartTimestamp(row.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {currentSelectedRevitTypes.length
                  ? '선택된 Revit 타입에 해당하는 저장 항목이 없습니다.'
                  : 'Revit 타입을 선택하면 해당 장바구니 항목이 표시됩니다.'}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px dashed #cbd5f5',
            padding: 10,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          선택된 건물/패밀리 항목에 대응하는 Work Master를
          <br />
          오른쪽 표에 표시합니다.
        </div>
      </div>
    </div>
  );
}

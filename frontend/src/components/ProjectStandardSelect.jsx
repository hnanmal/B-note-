import React, { useEffect, useMemo, useRef, useState } from 'react';
import StandardTreeManager from './StandardTreeManager';

export default function ProjectStandardSelect({ apiBaseUrl }) {
  const [selectedGwmNode, setSelectedGwmNode] = useState(null);
  const [dbWorkMasters, setDbWorkMasters] = useState([]);
  const [dbWorkMastersLoading, setDbWorkMastersLoading] = useState(false);
  const [dbWorkMastersError, setDbWorkMastersError] = useState(null);
  const [selectedWorkMasterId, setSelectedWorkMasterId] = useState(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState(null);
  const [workMasterSpecs, setWorkMasterSpecs] = useState({});
  const [workMasterSpecSaving, setWorkMasterSpecSaving] = useState({});
  const [workMasterSpecErrors, setWorkMasterSpecErrors] = useState({});
  const [gaugeAdding, setGaugeAdding] = useState({});
  const [gaugeAddErrors, setGaugeAddErrors] = useState({});
  const [gaugeRemoveErrors, setGaugeRemoveErrors] = useState({});
  const [gaugeRemoving, setGaugeRemoving] = useState({});
  const [workMasterReloadKey, setWorkMasterReloadKey] = useState(0);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [projectAbbr, setProjectAbbr] = useState('');
  const [copiedSelection, setCopiedSelection] = useState(null);
  const [workMasterSearch, setWorkMasterSearch] = useState('');
  const [workMasterMatchIndex, setWorkMasterMatchIndex] = useState(0);
  const workMasterRefs = useRef(new Map());

  const selectedGwmId = selectedGwmNode?.id ?? null;
  const effectiveStandardItemId = selectedGwmNode?.derive_from ?? selectedGwmId;
  const hasSelection = Boolean(selectedGwmNode);
  const isProjectContext = apiBaseUrl.includes('/project/');
  const isDerivedSelection = Boolean(selectedGwmNode?.derive_from);
  const isSwm = (selectedGwmNode?.type ?? '').toUpperCase() === 'SWM';

  const sortWorkMasters = (workMasters) => {
    const clones = Array.isArray(workMasters) ? [...workMasters] : [];
    return clones.sort((a, b) => {
      const codeA = (a?.work_master_code ?? '').toUpperCase();
      const codeB = (b?.work_master_code ?? '').toUpperCase();
      if (codeA < codeB) return -1;
      if (codeA > codeB) return 1;
      const gaugeA = (a?.gauge ?? '').trim().toUpperCase();
      const gaugeB = (b?.gauge ?? '').trim().toUpperCase();
      if (!gaugeA && gaugeB) return -1;
      if (gaugeA && !gaugeB) return 1;
      if (gaugeA < gaugeB) return -1;
      if (gaugeA > gaugeB) return 1;
      return (a?.id ?? 0) - (b?.id ?? 0);
    });
  };

  const buildWorkMasterSignature = (workMasters) => {
    if (!Array.isArray(workMasters) || !workMasters.length) return '';
    const ids = workMasters
      .map((wm) => Number(wm?.id))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => a - b);
    return ids.join(',');
  };

  const workMasterMatches = useMemo(() => {
    const term = (workMasterSearch || '').trim().toLowerCase();
    if (!term) return [];
    const collect = [];
    dbWorkMasters.forEach((wm) => {
      const haystack = [
        wm?.work_master_code,
        wm?.gauge,
        wm?.add_spec,
        wm?.cat_large_desc,
        wm?.cat_mid_desc,
        wm?.cat_small_desc,
        wm?.work_group_code,
        wm?.discipline,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      if (haystack.some((text) => text.includes(term))) {
        collect.push(wm.id);
      }
    });
    return collect;
  }, [dbWorkMasters, workMasterSearch]);

  useEffect(() => {
    setWorkMasterMatchIndex(0);
  }, [workMasterSearch]);

  useEffect(() => {
    if (!workMasterMatches.length) return;
    const targetId = workMasterMatches[Math.min(workMasterMatchIndex, workMasterMatches.length - 1)];
    const el = workMasterRefs.current.get(targetId);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [workMasterMatchIndex, workMasterMatches]);

  useEffect(() => {
    if (!selectedWorkMasterId) return;
    const el = workMasterRefs.current.get(selectedWorkMasterId);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedWorkMasterId, dbWorkMasters]);

  const getSelectedNodeDisplayName = () => {
    if (!selectedGwmNode) return '—';
    if (selectedGwmNode.derive_from) {
      const parentName = selectedGwmNode.parent?.name ?? '부모';
      const abbrPart = projectAbbr ? ` [${projectAbbr}]` : '';
      return `${parentName}${abbrPart}::${selectedGwmNode.name}`;
    }
    return selectedGwmNode.name ?? '—';
  };

  const buildSpecMapFromWorkMasters = (workMasters) => {
    const map = {};
    workMasters.forEach((wm) => {
      if (!wm || typeof wm.id === 'undefined') return;
      map[wm.id] = wm.add_spec ?? '';
    });
    return map;
  };

  useEffect(() => {
    const sourceStandardItemId = effectiveStandardItemId;
    const derivedStandardItemId = isDerivedSelection ? selectedGwmId : null;

    if (!sourceStandardItemId) {
      setDbWorkMasters([]);
      setDbWorkMastersError(null);
      setSelectedWorkMasterId(null);
      setWorkMasterSpecs({});
      setWorkMasterSpecErrors({});
      setWorkMasterSpecSaving({});
      setDbWorkMastersLoading(false);
      setGaugeAdding({});
      setGaugeAddErrors({});
      setGaugeRemoving({});
      setGaugeRemoveErrors({});
      return undefined;
    }

    let cancelled = false;
    setDbWorkMastersLoading(true);
    setDbWorkMastersError(null);
    setSelectionError(null);
    setGaugeAdding({});
    setGaugeAddErrors({});
    setGaugeRemoving({});
    setGaugeRemoveErrors({});

    fetch(`${apiBaseUrl}/standard-items/${sourceStandardItemId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Work Master 정보를 불러오지 못했습니다.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const workMasters = Array.isArray(data?.work_masters) ? data.work_masters : [];
        setSelectedGwmNode((prev) => {
          const isDerived = Boolean(prev?.derive_from ?? data?.derive_from);
          const derivedId = isDerived ? prev?.id : null;
          const derivedName = isDerived ? prev?.name : null;
          return {
            ...(prev ?? {}),
            ...data,
            derive_from: prev?.derive_from ?? data?.derive_from ?? null,
            id: derivedId ?? data?.id,
            name: derivedName ?? data?.name,
          };
        });
        if (!isDerivedSelection) {
          setSelectedWorkMasterId(data?.selected_work_master_id ?? null);
        }
        const sorted = sortWorkMasters(workMasters);
        setDbWorkMasters(sorted);
        setSelectionError(null);
        setWorkMasterSpecs(buildSpecMapFromWorkMasters(sorted));
      })
      .catch((error) => {
        if (cancelled) return;
        setDbWorkMastersError(
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setDbWorkMastersLoading(false);
        }
      });

    if (isDerivedSelection && derivedStandardItemId) {
      fetch(`${apiBaseUrl}/standard-items/${derivedStandardItemId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('파생 항목 선택 정보를 불러오지 못했습니다.');
          }
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          setSelectedGwmNode((prev) => {
            const isDerived = Boolean(prev?.derive_from ?? data?.derive_from);
            const derivedId = isDerived ? prev?.id ?? data?.id : data?.id;
            const derivedName = isDerived ? prev?.name ?? data?.name : data?.name;
            return {
              ...(prev ?? {}),
              ...data,
              derive_from: prev?.derive_from ?? data?.derive_from,
              id: derivedId,
              name: derivedName,
            };
          });
          setSelectedWorkMasterId(data?.selected_work_master_id ?? null);
          setSelectionError(null);
        })
        .catch((error) => {
          if (cancelled) return;
          setSelectionError(
            error instanceof Error ? error.message : '파생 항목 선택 정보를 불러오지 못했습니다.'
          );
        });
    }

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, effectiveStandardItemId, isDerivedSelection, selectedGwmId, workMasterReloadKey]);
  
  useEffect(() => {
    if (!apiBaseUrl.includes('/project/')) {
      setProjectAbbr('');
      return undefined;
    }
    let cancelled = false;
    fetch(`${apiBaseUrl}/metadata/abbr`)
      .then((res) => {
        if (!res.ok) throw new Error('약호를 불러오지 못했습니다.');
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setProjectAbbr(payload?.pjt_abbr ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setProjectAbbr('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const buildAttributeSummary = (workMaster) => {
    return [
      workMaster.attr1_spec,
      workMaster.attr2_spec,
      workMaster.attr3_spec,
      workMaster.attr4_spec,
      workMaster.attr5_spec,
      workMaster.attr6_spec,
    ]
      .filter(Boolean)
      .join(' | ');
  };

  const handleWorkMasterToggle = async (workMasterId) => {
    const baseItemId = selectedGwmId;
    const targetSelectionItemId = isDerivedSelection ? selectedGwmId : effectiveStandardItemId;
    if (!targetSelectionItemId || !baseItemId) return;

    const isSelecting = selectedWorkMasterId !== workMasterId;
    setSelectionLoading(true);
    setSelectionError(null);

    // Unselect
    if (!isSelecting) {
      try {
        const response = await fetch(`${apiBaseUrl}/standard-items/${targetSelectionItemId}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ work_master_id: null }),
        });
        if (!response.ok) {
          throw new Error('선택 저장에 실패했습니다.');
        }
        const payload = await response.json();
        setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
        setSelectedGwmNode((prev) => ({
          ...(prev ?? {}),
          selected_work_master_id: payload?.selected_work_master_id ?? null,
        }));
        setTreeRefreshKey((prev) => prev + 1);
      } catch (error) {
        setSelectionError(
          error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
        );
      } finally {
        setSelectionLoading(false);
      }
      return;
    }

    // Derived nodes: direct select
    if (isDerivedSelection) {
      try {
        const response = await fetch(`${apiBaseUrl}/standard-items/${targetSelectionItemId}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ work_master_id: workMasterId }),
        });
        if (!response.ok) {
          throw new Error('선택 저장에 실패했습니다.');
        }
        const payload = await response.json();
        setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
        setSelectedGwmNode((prev) => ({
          ...(prev ?? {}),
          selected_work_master_id: payload?.selected_work_master_id ?? null,
        }));
        setTreeRefreshKey((prev) => prev + 1);
      } catch (error) {
        setSelectionError(
          error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
        );
      } finally {
        setSelectionLoading(false);
      }
      return;
    }

    // SWM: force derive when selecting
    if (isSwm) {
      const suffix = window.prompt('파생 항목 접미 설명을 입력하세요. 예: 현장데이터');
      if (!suffix || !suffix.trim()) {
        setSelectionLoading(false);
        setSelectionError('접미 설명은 필수입니다.');
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/standard-items/${baseItemId}/derive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suffix_description: suffix.trim(),
            work_master_id: workMasterId,
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || '파생 항목을 생성할 수 없습니다.');
        }
        const payload = await response.json();
        setSelectedGwmNode(payload);
        setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
        setTreeRefreshKey((prev) => prev + 1);
        setSelectionError(null);
      } catch (error) {
        setSelectionError(
          error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
        );
      } finally {
        setSelectionLoading(false);
      }
      return;
    }

    // GWM: direct select (no derive)
    try {
      const response = await fetch(`${apiBaseUrl}/standard-items/${targetSelectionItemId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_master_id: workMasterId }),
      });
      if (!response.ok) {
        throw new Error('선택 저장에 실패했습니다.');
      }
      const payload = await response.json();
      setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
      setSelectedGwmNode((prev) => ({
        ...(prev ?? {}),
        selected_work_master_id: payload?.selected_work_master_id ?? null,
      }));
      setTreeRefreshKey((prev) => prev + 1);
      setSelectionError(null);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
      );
    } finally {
      setSelectionLoading(false);
    }
  };

  const applyWorkMasterSelection = async (workMasterId) => {
    const baseItemId = selectedGwmId;
    const targetSelectionItemId = isDerivedSelection ? selectedGwmId : effectiveStandardItemId;
    if (!targetSelectionItemId || !baseItemId) return;

    if (isSwm && !isDerivedSelection) {
      setSelectionError('SWM 파생이 필요한 항목에는 붙여넣기를 먼저 적용할 수 없습니다. 먼저 파생 생성 후 다시 시도하세요.');
      return;
    }

    try {
      setSelectionLoading(true);
      setSelectionError(null);
      const response = await fetch(`${apiBaseUrl}/standard-items/${targetSelectionItemId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_master_id: workMasterId }),
      });
      if (!response.ok) {
        throw new Error('선택 저장에 실패했습니다.');
      }
      const payload = await response.json();
      setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
      setSelectedGwmNode((prev) => ({
        ...(prev ?? {}),
        selected_work_master_id: payload?.selected_work_master_id ?? null,
      }));
      setTreeRefreshKey((prev) => prev + 1);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
      );
    } finally {
      setSelectionLoading(false);
    }
  };

  const handleWorkMasterSpecChange = (workMasterId, value) => {
    setWorkMasterSpecs((prev) => ({
      ...prev,
      [workMasterId]: value ?? '',
    }));
  };

  const handleCopySelection = () => {
    if (!hasSelection) {
      setSelectionError('GWM/SWM 항목을 먼저 선택하세요.');
      return;
    }
    if (!selectedWorkMasterId) {
      setSelectionError('복사할 WorkMaster 선택이 없습니다.');
      return;
    }
    const signature = buildWorkMasterSignature(dbWorkMasters);
    if (!signature) {
      setSelectionError('WorkMaster 목록이 비어 복사할 수 없습니다.');
      return;
    }
    setCopiedSelection({ workMasterId: selectedWorkMasterId, signature });
    setSelectionError(null);
  };

  const handlePasteSelection = async () => {
    if (!hasSelection) {
      setSelectionError('붙여넣을 대상 GWM/SWM을 먼저 선택하세요.');
      return;
    }
    if (!copiedSelection) {
      setSelectionError('복사된 WorkMaster 선택이 없습니다.');
      return;
    }
    const signature = buildWorkMasterSignature(dbWorkMasters);
    if (signature !== copiedSelection.signature) {
      setSelectionError('WorkMaster 선택지가 달라 붙여넣을 수 없습니다.');
      return;
    }
    if (selectedWorkMasterId === copiedSelection.workMasterId) {
      setSelectionError(null);
      return;
    }
    await applyWorkMasterSelection(copiedSelection.workMasterId);
  };

  const handleSaveWorkMasterSpec = async (workMasterId) => {
    const specValue = workMasterSpecs[workMasterId] ?? '';
    setWorkMasterSpecSaving((prev) => ({ ...prev, [workMasterId]: true }));
    setWorkMasterSpecErrors((prev) => ({ ...prev, [workMasterId]: null }));
    try {
      const response = await fetch(`${apiBaseUrl}/work-masters/${workMasterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_spec: specValue || null }),
      });
      if (!response.ok) {
        throw new Error('Spec 저장에 실패했습니다.');
      }
      const updated = await response.json();
      setDbWorkMasters((prev) =>
        prev.map((wm) => (wm.id === workMasterId ? { ...wm, add_spec: updated.add_spec ?? '' } : wm))
      );
      setWorkMasterSpecs((prev) => ({
        ...prev,
        [workMasterId]: updated.add_spec ?? '',
      }));
    } catch (error) {
      setWorkMasterSpecErrors((prev) => ({
        ...prev,
        [workMasterId]: error instanceof Error ? error.message : 'Spec 저장에 실패했습니다.',
      }));
    } finally {
      setWorkMasterSpecSaving((prev) => ({ ...prev, [workMasterId]: false }));
    }
  };

  const handleAddGauge = async (workMasterId) => {
    if (!isProjectContext) return;
    setGaugeAdding((prev) => ({ ...prev, [workMasterId]: true }));
    setGaugeAddErrors((prev) => ({ ...prev, [workMasterId]: null }));
    try {
      const response = await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/add-gauge`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('게이지 항목을 생성할 수 없습니다.');
      }
      await response.json();
      setWorkMasterReloadKey((prev) => prev + 1);
    } catch (error) {
      setGaugeAddErrors((prev) => ({
        ...prev,
        [workMasterId]:
          error instanceof Error ? error.message : '게이지 저장에 실패했습니다.',
      }));
    } finally {
      setGaugeAdding((prev) => ({ ...prev, [workMasterId]: false }));
    }
  };

  const handleRemoveGauge = async (workMasterId) => {
    if (!isProjectContext) return;
    setGaugeRemoving((prev) => ({ ...prev, [workMasterId]: true }));
    setGaugeRemoveErrors((prev) => ({ ...prev, [workMasterId]: null }));
    try {
      const response = await fetch(`${apiBaseUrl}/work-masters/${workMasterId}/remove-gauge`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('게이지를 삭제할 수 없습니다.');
      }
      await response.json();
      setWorkMasterReloadKey((prev) => prev + 1);
    } catch (error) {
      setGaugeRemoveErrors((prev) => ({
        ...prev,
        [workMasterId]:
          error instanceof Error ? error.message : '게이지 삭제에 실패했습니다.',
      }));
    } finally {
      setGaugeRemoving((prev) => ({ ...prev, [workMasterId]: false }));
    }
  };

  const renderWorkMasterDetail = (workMaster) => {
    const headline =
      workMaster.cat_large_desc || workMaster.cat_mid_desc || workMaster.cat_small_desc ||
      `Work Master ${workMaster.id}`;
    const categoryLabel = [workMaster.cat_mid_desc, workMaster.cat_small_desc]
      .filter(Boolean)
      .join(' / ');
    const attrSummary = buildAttributeSummary(workMaster);
    const uomLabel = [workMaster.uom1, workMaster.uom2].filter(Boolean).join(' / ');
    const codeLine = workMaster.work_master_code ? `코드 ${workMaster.work_master_code}` : '코드 정보 없음';
    const gaugeValue = (workMaster.gauge ?? '').trim().toUpperCase();
    const codeTags = [
      workMaster.cat_large_code,
      workMaster.cat_mid_code,
      workMaster.cat_small_code,
    ]
      .filter(Boolean)
      .join(' / ');

    const specValue = workMasterSpecs[workMaster.id] ?? workMaster.add_spec ?? '';
    const isSpecSaving = Boolean(workMasterSpecSaving[workMaster.id]);
    const specError = workMasterSpecErrors[workMaster.id];
    const isGaugeAdding = Boolean(gaugeAdding[workMaster.id]);
    const gaugeError = gaugeAddErrors[workMaster.id];
    const isGaugeRemoving = Boolean(gaugeRemoving[workMaster.id]);
    const gaugeRemoveError = gaugeRemoveErrors[workMaster.id];
    const gaugeButtonDisabled = !isProjectContext || selectionLoading || isGaugeAdding;
    const gaugeButtonTitle = !isProjectContext ? '프로젝트에서만 게이지를 추가할 수 있습니다.' : undefined;
    const isSelected = selectedWorkMasterId === workMaster.id;
    const handleToggle = () => handleWorkMasterToggle(workMaster.id);

    return (
      <label
        key={workMaster.id}
        ref={(el) => {
          if (el) workMasterRefs.current.set(workMaster.id, el);
          else workMasterRefs.current.delete(workMaster.id);
        }}
        style={{
          borderRadius: 10,
          background: isSelected ? '#f5f3ff' : '#fff',
          border: `1px solid ${isSelected ? '#7c3aed' : '#e5e7eb'}`,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          cursor: selectionLoading ? 'not-allowed' : 'pointer',
          transition: 'border 0.2s ease',
          outline: workMasterMatches.includes(workMaster.id) && workMasterSearch.trim()
            ? '1px solid #a855f7'
            : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleToggle}
            disabled={selectionLoading}
            style={{ width: 18, height: 18 }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{headline}</div>
        </div>
        {categoryLabel && <div style={{ fontSize: 12, color: '#475467' }}>{categoryLabel}</div>}
        {codeTags && <div style={{ fontSize: 11, color: '#7c3aed' }}>{codeTags}</div>}
        {attrSummary && <div style={{ fontSize: 12, color: '#374151' }}>{attrSummary}</div>}
        {uomLabel && <div style={{ fontSize: 12, color: '#374151' }}>UoM: {uomLabel}</div>}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#9333ea',
            }}
          >
            <span>{codeLine}</span>
            <span
              style={{
                minWidth: 22,
                textAlign: 'center',
                borderRadius: 4,
                border: '1px solid #e5e7eb',
                padding: '2px 6px',
                fontSize: 11,
                color: '#0f172a',
                background: '#fff',
              }}
            >
              {gaugeValue || ' '}
            </span>
          </div>
        <div
          style={{
            fontSize: 11,
            color: '#475467',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Discipline: {workMaster.discipline ?? '—'}</span>
          <span>Group: {workMaster.work_group_code ?? '—'}</span>
          <span>구분: {workMaster.new_old_code ?? '—'}</span>
        </div>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ fontSize: 11, color: '#475467' }}>추가 Spec</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={specValue}
              onChange={(e) => handleWorkMasterSpecChange(workMaster.id, e.target.value)}
              disabled={selectionLoading || isSpecSaving}
              placeholder="WorkMaster spec"
              rows={3}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                background: '#fff',
                minWidth: 0,
                resize: 'vertical',
              }}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleSaveWorkMasterSpec(workMaster.id);
              }}
              disabled={selectionLoading || isSpecSaving}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                cursor: selectionLoading || isSpecSaving ? 'not-allowed' : 'pointer',
                height: 'fit-content',
                alignSelf: 'flex-start',
              }}
            >
              {isSpecSaving ? '저장 중...' : '저장'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleAddGauge(workMaster.id);
              }}
              disabled={gaugeButtonDisabled}
              title={gaugeButtonTitle}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                background: gaugeButtonDisabled ? '#f1f5f9' : '#fff',
                color: gaugeButtonDisabled ? '#94a3b8' : '#0f172a',
                cursor: gaugeButtonDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isGaugeAdding ? '추가 중...' : '게이지 추가'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRemoveGauge(workMaster.id);
              }}
              disabled={!gaugeValue || selectionLoading || isGaugeRemoving}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #f87171',
                background: !gaugeValue || selectionLoading || isGaugeRemoving ? '#fee2e2' : '#fff',
                color: !gaugeValue || selectionLoading || isGaugeRemoving ? '#fca5a5' : '#dc2626',
                cursor: !gaugeValue || selectionLoading || isGaugeRemoving ? 'not-allowed' : 'pointer',
              }}
            >
              {isGaugeRemoving ? '삭제 중...' : '게이지 삭제'}
            </button>
            {gaugeError && (
              <div style={{ fontSize: 11, color: '#b91c1c' }}>{gaugeError}</div>
            )}
            {gaugeRemoveError && (
              <div style={{ fontSize: 11, color: '#b91c1c' }}>{gaugeRemoveError}</div>
            )}
          </div>
          {specError && (
            <div style={{ fontSize: 11, color: '#b91c1c' }}>{specError}</div>
          )}
        </div>
      </label>
    );
  };

  const renderWorkMasterDetailsSection = () => (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: 12,
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>WorkMaster Selection</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={workMasterSearch}
            onChange={(e) => setWorkMasterSearch(e.target.value)}
            placeholder="WorkMaster 검색"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid #cbd5f5',
              minWidth: 140,
            }}
          />
          <div style={{ fontSize: 11, color: '#475467', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{workMasterMatches.length || 0} / {dbWorkMasters.length || 0}개</span>
            <button
              type="button"
              onClick={() => setWorkMasterMatchIndex((prev) => Math.max(prev - 1, 0))}
              disabled={!workMasterMatches.length || workMasterMatchIndex <= 0}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontSize: 11,
                cursor: !workMasterMatches.length || workMasterMatchIndex <= 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => {
                if (!workMasterMatches.length) return;
                setWorkMasterMatchIndex((prev) => Math.min(prev + 1, workMasterMatches.length - 1));
              }}
              disabled={!workMasterMatches.length || workMasterMatchIndex >= workMasterMatches.length - 1}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontSize: 11,
                cursor:
                  !workMasterMatches.length || workMasterMatchIndex >= workMasterMatches.length - 1
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              ↓
            </button>
            {workMasterMatches.length > 0 && (
              <span>
                {Math.min(workMasterMatchIndex + 1, workMasterMatches.length)} / {workMasterMatches.length}
              </span>
            )}
          </div>
        </div>
      </div>
      {selectionLoading && (
        <div style={{ fontSize: 11, color: '#475467' }}>선택 저장 중입니다...</div>
      )}
      {selectionError && (
        <div style={{ fontSize: 12, color: '#b91c1c' }}>{selectionError}</div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0,
          flex: 1,
          overflowY: 'auto',
          height: '100%',
        }}
      >
        {dbWorkMastersLoading ? (
          <div style={{ fontSize: 12, color: '#475467' }}>Work Master 정보를 불러오는 중입니다...</div>
        ) : dbWorkMastersError ? (
          <div style={{ fontSize: 12, color: '#b91c1c' }}>{dbWorkMastersError}</div>
        ) : dbWorkMasters.length ? (
          dbWorkMasters.map((wm) => renderWorkMasterDetail(wm))
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>선택한 GWM에 할당된 Work Master가 없습니다.</div>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 12,
        }}
      >
        Standard GWM Tree
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '2fr 2.3fr',
          gap: 24,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 12,
            minHeight: 0,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <StandardTreeManager
              apiBaseUrl={apiBaseUrl}
              refreshSignal={treeRefreshKey}
              externalSelectedId={selectedGwmNode?.id ?? null}
              onNodeSelect={(payload) => {
                if (payload?.node) {
                  setSelectedGwmNode(payload.node);
                } else {
                  setSelectedGwmNode(null);
                }
              }}
            />
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#f8fafc',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minWidth: 360,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>WorkMaster Selection</span>
            {hasSelection && (
              <span style={{ fontSize: 11, color: '#475467' }}>
                선택된 GWM: {getSelectedNodeDisplayName()} (ID: {selectedGwmNode?.id ?? '—'})
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475467' }}>
            {hasSelection
              ? '선택한 GWM에 할당된 Work Master 상세 정보를 보여드립니다.'
              : 'GWM 트리에서 항목을 선택하면 관련 Work Master 정보가 나타납니다.'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopySelection}
              disabled={!hasSelection || !selectedWorkMasterId}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontSize: 12,
                cursor: !hasSelection || !selectedWorkMasterId ? 'not-allowed' : 'pointer',
              }}
            >
              선택 복사
            </button>
            <button
              type="button"
              onClick={handlePasteSelection}
              disabled={!hasSelection || !copiedSelection}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontSize: 12,
                cursor: !hasSelection || !copiedSelection ? 'not-allowed' : 'pointer',
              }}
            >
              붙여넣기
            </button>
            {copiedSelection && (
              <span style={{ fontSize: 11, color: '#475467' }}>
                복사된 WorkMaster ID: {copiedSelection.workMasterId}
              </span>
            )}
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 12,
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {hasSelection ? (
              renderWorkMasterDetailsSection()
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                왼쪽 GWM 트리에서 항목을 선택하면 Work Master 정보가 이곳에 나타납니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

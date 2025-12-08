import React, { useEffect, useState } from 'react';
import StandardTreeManager from './StandardTreeManager';

export default function ProjectStandardSelect({ apiBaseUrl }) {
  const [selectedGwmNode, setSelectedGwmNode] = useState(null);
  const [dbWorkMasters, setDbWorkMasters] = useState([]);
  const [dbWorkMastersLoading, setDbWorkMastersLoading] = useState(false);
  const [dbWorkMastersError, setDbWorkMastersError] = useState(null);
  const [selectedWorkMasterId, setSelectedWorkMasterId] = useState(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState(null);

  const selectedGwmId = selectedGwmNode?.id ?? null;
  const hasSelection = Boolean(selectedGwmNode);

  useEffect(() => {
    if (!selectedGwmId) {
      setDbWorkMasters([]);
      setDbWorkMastersError(null);
      setSelectedWorkMasterId(null);
      setDbWorkMastersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDbWorkMastersLoading(true);
    setDbWorkMastersError(null);
    setSelectionError(null);
    fetch(`${apiBaseUrl}/standard-items/${selectedGwmId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Work Master 정보를 불러오지 못했습니다.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDbWorkMasters(Array.isArray(data?.work_masters) ? data.work_masters : []);
        setSelectedGwmNode((prev) => ({ ...(prev ?? {}), ...data }));
        setSelectedWorkMasterId(data?.selected_work_master_id ?? null);
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
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, selectedGwmId]);

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
    if (!selectedGwmId) return;
    const nextId = selectedWorkMasterId === workMasterId ? null : workMasterId;
    setSelectionLoading(true);
    setSelectionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/standard-items/${selectedGwmId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_master_id: nextId }),
      });
      if (!response.ok) {
        throw new Error('선택 저장에 실패했습니다.');
      }
      const payload = await response.json();
      setSelectedWorkMasterId(payload?.selected_work_master_id ?? null);
      setSelectedGwmNode((prev) => ({ ...(prev ?? {}), selected_work_master_id: payload?.selected_work_master_id ?? null }));
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : '선택 저장에 실패했습니다.'
      );
    } finally {
      setSelectionLoading(false);
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
    const codeTags = [
      workMaster.cat_large_code,
      workMaster.cat_mid_code,
      workMaster.cat_small_code,
    ]
      .filter(Boolean)
      .join(' / ');

    const isSelected = selectedWorkMasterId === workMaster.id;
    const handleToggle = () => handleWorkMasterToggle(workMaster.id);

    return (
      <label
        key={workMaster.id}
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
        <div style={{ fontSize: 13, color: '#9333ea', fontWeight: 600 }}>{codeLine}</div>
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
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>WorkMaster Matching</div>
        <div style={{ fontSize: 11, color: '#475467' }}>
          {dbWorkMasters.length ? `${dbWorkMasters.length}개 항목` : '항목 없음'}
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
          maxHeight: 500,
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
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <StandardTreeManager
              apiBaseUrl={apiBaseUrl}
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
            <span>WorkMaster Matching</span>
            {hasSelection && (
              <span style={{ fontSize: 11, color: '#475467' }}>
                선택된 GWM: {selectedGwmNode?.name ?? '—'} (ID: {selectedGwmNode?.id ?? '—'})
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475467' }}>
            {hasSelection
              ? '선택한 GWM에 할당된 Work Master 상세 정보를 보여드립니다.'
              : 'GWM 트리에서 항목을 선택하면 관련 Work Master 정보가 나타납니다.'}
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

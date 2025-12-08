import React, { useEffect, useMemo, useState } from 'react';
import StandardTreeManager from './StandardTreeManager';
import { formatCartTimestamp, readWorkMasterCartEntries } from '../utils/workMasterCart';

export default function ProjectStandardSelect({ apiBaseUrl }) {
  const [savedCartEntries, setSavedCartEntries] = useState(() => readWorkMasterCartEntries());
  const [selectedGwmNode, setSelectedGwmNode] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [dbWorkMasters, setDbWorkMasters] = useState([]);
  const [dbWorkMastersLoading, setDbWorkMastersLoading] = useState(false);
  const [dbWorkMastersError, setDbWorkMastersError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => setSavedCartEntries(readWorkMasterCartEntries());
    window.addEventListener('workmaster-cart-changed', refresh);
    return () => window.removeEventListener('workmaster-cart-changed', refresh);
  }, []);

  const selectedGwmId = selectedGwmNode?.id ?? null;
  const matchedEntries = useMemo(() => {
    if (!selectedGwmId) return [];
    return savedCartEntries.filter((entry) => {
      if (Array.isArray(entry.standardItemIds) && entry.standardItemIds.includes(selectedGwmId)) {
        return true;
      }
      return Array.isArray(entry.assignmentIds) && entry.assignmentIds.includes(selectedGwmId);
    });
  }, [savedCartEntries, selectedGwmId]);

  const hasSelection = Boolean(selectedGwmNode);
  const selectedRevitLabel = Array.isArray(selectedGwmNode?.revitTypes) &&
    selectedGwmNode.revitTypes.length
    ? selectedGwmNode.revitTypes.join(', ')
    : '항목';

  useEffect(() => {
    setSelectedCartId(null);
  }, [selectedGwmId]);

  useEffect(() => {
    if (!selectedGwmId) {
      setDbWorkMasters([]);
      setDbWorkMastersError(null);
      setDbWorkMastersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDbWorkMastersLoading(true);
    setDbWorkMastersError(null);
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

  const renderEntry = (entry, highlighted) => {
    const revitLabel = Array.isArray(entry.revitTypes) && entry.revitTypes.length
      ? entry.revitTypes.join(', ')
      : '선택된 Revit 타입';
    const assignmentCount = Array.isArray(entry.assignmentIds) ? entry.assignmentIds.length : 0;
    const isChecked = selectedCartId === entry.id;
    const handleToggle = () => setSelectedCartId((prev) => (prev === entry.id ? null : entry.id));
    return (
      <label
        key={entry.id}
        style={{
          borderRadius: 10,
          padding: '10px 12px',
          border: `1px solid ${highlighted ? '#7c3aed' : '#e5e7eb'}`,
          background: highlighted ? '#eef2ff' : '#fff',
          boxShadow: highlighted ? '0 2px 6px rgba(79,70,229,0.18)' : '0 1px 4px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 12,
          color: '#0f172a',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleToggle}
          style={{ alignSelf: 'flex-start' }}
        />
        <div style={{ fontWeight: 600 }}>{revitLabel}</div>
        <div style={{ fontSize: 11, color: '#475467', display: 'flex', gap: 6 }}>
          <span>{assignmentCount}개 Work Master 항목</span>
          <span>·</span>
          <span>저장 {formatCartTimestamp(entry.createdAt)}</span>
        </div>
      </label>
    );
  };

  const renderDbWorkMastersSection = () => (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: 12,
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>DB Work Master</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {dbWorkMastersLoading ? (
          <div style={{ fontSize: 12, color: '#475467' }}>Work Master 정보를 불러오는 중입니다...</div>
        ) : dbWorkMastersError ? (
          <div style={{ fontSize: 12, color: '#b91c1c' }}>{dbWorkMastersError}</div>
        ) : dbWorkMasters.length ? (
          dbWorkMasters.map((wm) => (
            <div
              key={wm.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#0f172a',
                padding: '4px 0',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <span>ID {wm.id}</span>
              <span>{wm.work_master_code ?? '—'}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>선택한 GWM에 할당된 Work Master가 없습니다.</div>
        )}
      </div>
    </div>
  );

  const renderSavedCartSection = () => (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid #dae1f3',
        background: '#f8fafc',
        minHeight: 120,
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
        <span>
          선택된 {selectedRevitLabel}을 위한
        </span>
        <span style={{ flex: 1 }} />
        <span>Work Master 장바구니 👜</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matchedEntries.length ? (
          matchedEntries.map((entry) => renderEntry(entry, true))
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>저장된 항목이 없습니다.</div>
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
          gridTemplateColumns: '3fr 1.2fr',
          gap: 16,
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
            <span>WorkMaster Select</span>
            {hasSelection && (
              <span style={{ fontSize: 11, color: '#475467' }}>
                선택된 GWM: {selectedGwmNode?.name ?? '—'} (ID: {selectedGwmNode?.id ?? '—'})
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475467' }}>
            {hasSelection
              ? '선택한 GWM에 할당된 Work Master 장바구니를 보여드립니다.'
              : 'GWM 트리에서 항목을 선택하면 관련 Work Master 저장 항목이 나타납니다.'}
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
              gap: 10,
            }}
          >
            {hasSelection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {renderDbWorkMastersSection()}
                {renderSavedCartSection()}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                왼쪽 GWM 트리에서 항목을 선택하면 할당된 Work Master 항목이 이곳에 나타납니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

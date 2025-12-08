import React, { useEffect, useState } from 'react';
import StandardTreeManager from './StandardTreeManager';
import { formatCartTimestamp, readWorkMasterCartEntries } from '../utils/workMasterCart';

export default function ProjectStandardSelect({ apiBaseUrl }) {
  const [savedCartEntries, setSavedCartEntries] = useState(() => readWorkMasterCartEntries());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => setSavedCartEntries(readWorkMasterCartEntries());
    window.addEventListener('workmaster-cart-changed', refresh);
    return () => window.removeEventListener('workmaster-cart-changed', refresh);
  }, []);

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
          display: 'grid',
          gridTemplateColumns: '3fr 1.2fr',
          gap: 16,
          minHeight: 0,
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
            <StandardTreeManager apiBaseUrl={apiBaseUrl} />
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
            }}
          >
            WorkMaster Select
          </div>
          <div style={{ fontSize: 11, color: '#475467' }}>저장된 Work Master를 이곳에서 확인하세요.</div>
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
            {savedCartEntries.length ? (
              savedCartEntries.map((entry) => {
                const revitLabel = Array.isArray(entry.revitTypes) && entry.revitTypes.length
                  ? entry.revitTypes.join(', ')
                  : '선택된 Revit 타입';
                const assignmentCount = Array.isArray(entry.assignmentIds) ? entry.assignmentIds.length : 0;
                return (
                  <div
                    key={entry.id}
                    style={{
                      borderRadius: 10,
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      color: '#0f172a',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{revitLabel}</div>
                    <div style={{ fontSize: 11, color: '#475467', display: 'flex', gap: 6 }}>
                      <span>{assignmentCount}개 Work Master 항목</span>
                      <span>·</span>
                      <span>저장 {formatCartTimestamp(entry.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>저장된 항목이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

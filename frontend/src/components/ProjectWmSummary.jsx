import React from 'react';

export default function ProjectWmSummary({ apiBaseUrl }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>WM Summary</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          WorkMaster Selection 결과 요약 페이지 (추후 구현)
        </div>
        {apiBaseUrl ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>API: {apiBaseUrl}</div>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 12,
          border: '1px dashed #cbd5f5',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontSize: 13,
        }}
      >
        Empty
      </div>
    </div>
  );
}

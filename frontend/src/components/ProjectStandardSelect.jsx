import React from 'react';
import StandardTreeManager from './StandardTreeManager';

export default function ProjectStandardSelect({ apiBaseUrl }) {
  return (
    <div
      style={{
        height: '100%',
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 12,
          marginBottom: 12,
        }}
      >
        Standard GWM Tree
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <StandardTreeManager apiBaseUrl={apiBaseUrl} />
      </div>
    </div>
  );
}

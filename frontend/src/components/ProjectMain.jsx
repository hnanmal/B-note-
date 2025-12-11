import React from 'react';

export default function ProjectMain({ apiBaseUrl }) {
  return (
    <div
      style={{
        height: '100%',
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0 }}>Project Main</h2>
      <p style={{ margin: 0, color: '#475467' }}>
        프로젝트 메인 컨트롤 패널이 준비 중입니다. 주요 항목과 빠른 상태 정보를 이곳에 모아둘 예정입니다.
      </p>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        사용 중인 API 베이스: <code>{apiBaseUrl}</code>
      </div>
      <div style={{ fontSize: 13, color: '#0f172a' }}>
        현재 탭에서 구현할 기능이 필요하면, 이 영역을 기준으로 확장 작업을 진행하시면 됩니다.
      </div>
    </div>
  );
}

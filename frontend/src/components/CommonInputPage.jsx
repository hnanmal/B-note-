import React from 'react';
import CommonInputManager from './CommonInputManager';

export default function CommonInputPage() {
  return (
    <div style={{ height: '100%', background: '#ffffff', borderRadius: 14, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#475467' }}>Common Input Setting</div>
        <h1 style={{ fontSize: 28, margin: '8px 0', color: '#111827' }}>공통 입력 설정</h1>
        <p style={{ color: '#475467', lineHeight: 1.6 }}>분류별로 공통 입력값을 정의하여 프로젝트 전반에서 일관된 템플릿을 제공합니다.</p>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CommonInputManager />
      </div>
    </div>
  );
}

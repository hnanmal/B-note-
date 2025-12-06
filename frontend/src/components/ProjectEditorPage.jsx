import React from 'react';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const kilo = bytes / 1024;
  if (kilo < 1024) return `${kilo.toFixed(2)} KB`;
  const mega = kilo / 1024;
  if (mega < 1024) return `${mega.toFixed(2)} MB`;
  return `${(mega / 1024).toFixed(2)} GB`;
};

export default function ProjectEditorPage({ projectDb, onClose }) {
  if (!projectDb) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475467',
        }}
      >
        편집할 프로젝트를 선택해주세요.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <div style={{ fontSize: 14, color: '#475467', marginBottom: 4 }}>Project Editor · {projectDb.display_name}</div>
        <h1 style={{ margin: 0, fontSize: 28, color: '#111827' }}>프로젝트 단위 편집</h1>
        <p style={{ margin: '8px 0 0', color: '#475467', lineHeight: 1.6 }}>
          이 페이지에서 프로젝트별 편집 작업을 진행합니다. 현재 레이아웃은 App과 동일하며 필요한 작업을 프로젝트 데이터에 반영할 수 있습니다.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: 12, color: '#475467' }}>프로젝트 이름</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{projectDb.display_name}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: '#fef9c3', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div style={{ fontSize: 12, color: '#475467' }}>파일명</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#92400e' }}>{projectDb.file_name}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: '#ecfeff', border: '1px solid rgba(14,165,233,0.2)' }}>
          <div style={{ fontSize: 12, color: '#475467' }}>생성일</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{formatDate(projectDb.created_at)}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: '#ecfccb', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize: 12, color: '#475467' }}>용량</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#047857' }}>{formatBytes(projectDb.size)}</div>
        </div>
      </section>

      <section style={{ flex: 1, background: '#f8fafc', borderRadius: 12, border: '1px dashed rgba(148,163,184,0.8)', padding: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#475467' }}>
          실제 프로젝트 편집 UI는 이 영역에 들어갑니다. 팀스탠다드 편집이 아닌 프로젝트 단위 편집이므로 별도로 구성하고 싶은 컨트롤을 추가해주세요.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
          (현재는 placeholder 영역입니다.)
        </p>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: '1 1 auto',
            borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.2)',
            background: '#fff',
            color: '#0f172a',
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          프로젝트 운영으로 돌아가기
        </button>
        <button
          type="button"
          disabled
          style={{
            flex: '1 1 auto',
            borderRadius: 8,
            border: 'none',
            background: '#1d4ed8',
            color: '#fff',
            fontWeight: 600,
            padding: '10px 16px',
          }}
        >
          모듈 설정 (준비 중)
        </button>
      </div>
    </div>
  );
}

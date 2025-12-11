import React, { useCallback, useEffect, useState } from 'react';

export default function ProjectMain({ apiBaseUrl }) {
  const [abbr, setAbbr] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');

  const loadAbbreviation = useCallback(async () => {
    setStatusMessage('');
    setStatusType('');
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/metadata/abbr`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '프로젝트 약호를 불러올 수 없습니다.');
      }
      const payload = await response.json();
      setAbbr(payload.pjt_abbr ?? '');
      setDescription(payload.pjt_description ?? '');
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : '프로젝트 약호를 불러오는 도중 문제가 발생했습니다.'
      );
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadAbbreviation();
  }, [loadAbbreviation]);

  const handleSave = async () => {
    setStatusMessage('');
    setStatusType('');
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/metadata/abbr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pjt_abbr: abbr.trim() || null,
          pjt_description: description.trim() || null,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '프로젝트 약호를 저장하지 못했습니다.');
      }
      const payload = await response.json();
      setAbbr(payload.pjt_abbr ?? '');
      setStatusMessage('프로젝트 약호가 저장되었습니다.');
      setStatusType('success');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.');
      setStatusType('error');
    } finally {
      setSaving(false);
    }
  };

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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          border: '1px solid #e5e7eb',
          padding: 16,
          borderRadius: 12,
          background: '#f8fafc',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>프로젝트 약호</div>
        <input
          type="text"
          value={abbr}
          onChange={(event) => setAbbr(event.target.value)}
          placeholder="예: DQRU"
          disabled={loading || saving}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #cbd5f5',
            fontSize: 14,
          }}
        />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>프로젝트 설명</div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="이 프로젝트에 대한 간단한 설명을 입력하세요."
          disabled={loading || saving}
          rows={3}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: '1px solid #cbd5f5',
            fontSize: 14,
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          style={{
            marginTop: 8,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: saving || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <div style={{ fontSize: 12, color: '#475467', marginTop: 6 }}>
          현재 설정된 프로젝트 약호는 입력한 값으로 저장되며, 다른 탭에서도 동일하게 표시됩니다.
        </div>
        {statusMessage && (
          <div
            style={{
              fontSize: 12,
              color: statusType === 'success' ? '#047857' : '#b91c1c',
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        사용 중인 API 베이스: <code>{apiBaseUrl}</code>
      </div>
      <div style={{ fontSize: 13, color: '#0f172a' }}>
        현재 탭에서 구현할 기능이 필요하면, 이 영역을 기준으로 확장 작업을 진행하시면 됩니다.
      </div>
    </div>
  );
}

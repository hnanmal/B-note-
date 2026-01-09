import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { API_BASE_URL } from '../apiConfig';
import appLogoMainTab from '../assets/app_logo_maintab.png';
const ADMIN_KEY = 'HECBIM';

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const kilo = bytes / 1024;
  if (kilo < 1024) return `${kilo.toFixed(2)} KB`;
  const mega = kilo / 1024;
  if (mega < 1024) return `${mega.toFixed(2)} MB`;
  return `${(mega / 1024).toFixed(2)} GB`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const parseResponse = async (response) => {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // ignore JSON parse errors; fall back to raw text
  }
  if (!response.ok) {
    const message = payload?.detail || payload?.message || text || response.statusText;
    throw new Error(message || '요청 처리 중 오류가 발생했습니다.');
  }
  return payload;
};

export default function ProjectPage() {
  const [projectDbs, setProjectDbs] = useState([]);
  const [newName, setNewName] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [status, setStatus] = useState(null);
  const [renameTarget, setRenameTarget] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupItems, setBackupItems] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const fetchProjectDbs = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/`);
      const data = (await parseResponse(response)) || [];
      setProjectDbs(data);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || '프로젝트 DB 목록을 불러오지 못했습니다.' });
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchProjectDbs();
  }, [fetchProjectDbs]);

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/backups/`);
      const data = (await parseResponse(response)) || [];
      setBackupItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || '백업 DB 목록을 불러오지 못했습니다.' });
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  const setTemporaryError = (message) => setStatus({ type: 'error', message });

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setTemporaryError('DB 이름을 입력해주세요.');
      return;
    }
    setActionPending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: trimmed }),
      });
      await parseResponse(response);
      setNewName('');
      setStatus({ type: 'success', message: `’${trimmed}’ 프로젝트 DB가 생성되었습니다.` });
      await fetchProjectDbs();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setActionPending(false);
    }
  };

  const handleCopy = async (fileName, displayName) => {
    setActionPending(true);
    const copyName = `${displayName} Copy`;
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/${encodeURIComponent(fileName)}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: copyName }),
      });
      const result = await parseResponse(response);
      const createdName = result?.display_name || copyName;
      setStatus({ type: 'success', message: `’${displayName}’을 복사하여 '${createdName}'이(가) 생성되었습니다.` });
      await fetchProjectDbs();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setActionPending(false);
    }
  };

  const handleBackup = async (fileName, displayName) => {
    setActionPending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/${encodeURIComponent(fileName)}/backup`, {
        method: 'POST',
      });
      const result = await parseResponse(response);
      const backupFileName = result?.backup_file_name;
      setStatus({
        type: 'success',
        message: backupFileName
          ? `’${displayName}’ 백업 완료: ${backupFileName}`
          : `’${displayName}’ 백업이 생성되었습니다.`,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setActionPending(false);
    }
  };

  const startRename = (db) => {
    setRenameTarget(db.file_name);
    setRenameValue(db.display_name);
    setStatus(null);
  };

  const cancelRename = () => {
    setRenameTarget('');
    setRenameValue('');
  };

  const commitRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setTemporaryError('변경할 이름을 입력하세요.');
      return;
    }
    setActionPending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/${encodeURIComponent(renameTarget)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_display_name: trimmed }),
      });
      await parseResponse(response);
      setStatus({ type: 'success', message: '이름이 업데이트되었습니다.' });
      cancelRename();
      await fetchProjectDbs();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setActionPending(false);
    }
  };

  const handleOpenProjectRoute = useCallback((db) => {
    const slugFromFile = db.file_name?.replace(/\.db$/i, '');
    const nameForRoute = slugFromFile || db.display_name || 'project';
    const route = `/project/${encodeURIComponent(nameForRoute)}`;
    window.open(route, '_blank');
  }, []);

  const handleDelete = async (fileName, displayName) => {
    const trimmedKey = adminKey.trim();
    if (trimmedKey !== ADMIN_KEY) {
      setTemporaryError('올바른 admin 키를 입력해 주세요.');
      return;
    }
    setActionPending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-db/${encodeURIComponent(fileName)}?admin_key=${encodeURIComponent(trimmedKey)}`, {
        method: 'DELETE',
      });
      await parseResponse(response);
      setStatus({ type: 'success', message: `’${displayName}’ 프로젝트 DB가 삭제되었습니다.` });
      await fetchProjectDbs();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setActionPending(false);
    }
  };

  const openBackupModal = async () => {
    setBackupModalOpen(true);
    await fetchBackups();
  };

  const closeBackupModal = () => {
    setBackupModalOpen(false);
  };

  const handlePromoteBackup = async (backupFileName, backupDisplayName) => {
    if (!backupFileName) return;
    setActionPending(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/project-db/backups/${encodeURIComponent(backupFileName)}/promote`,
        { method: 'POST' }
      );
      const result = await parseResponse(response);
      const createdName = result?.display_name || backupDisplayName || backupFileName;
      setStatus({ type: 'success', message: `백업을 프로젝트로 생성했습니다: ${createdName}` });
      await fetchProjectDbs();
      await fetchBackups();
    } catch (error) {
      setStatus({ type: 'error', message: error.message || '백업을 프로젝트로 만들지 못했습니다.' });
    } finally {
      setActionPending(false);
    }
  };

  const lastUpdated = useMemo(() => {
    if (!projectDbs.length) return 'N/A';
    const latest = projectDbs.reduce((prev, current) => {
      const prevTime = new Date(prev.created_at).getTime();
      const currentTime = new Date(current.created_at).getTime();
      return currentTime >= prevTime ? current : prev;
    });
    return formatDate(latest.created_at);
  }, [projectDbs]);

  const totalCount = projectDbs.length;
  const totalSize = useMemo(() => {
    if (!projectDbs.length) return '0 KB';
    return formatBytes(projectDbs.reduce((sum, db) => sum + (db.size || 0), 0));
  }, [projectDbs]);

  const statusStyle = useMemo(() => {
    if (!status) return { background: '#f1f5f9', color: '#0f172a' };
    return status.type === 'error'
      ? { background: '#fee2e2', color: '#b91c1c' }
      : { background: '#dcfce7', color: '#166534' };
  }, [status]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: 20, background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(31,41,55,0.08)' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img
            src={appLogoMainTab}
            alt="B-note+"
            style={{ width: 220, maxWidth: '100%', height: 'auto', display: 'block' }}
          />
          <div style={{ minWidth: 240, flex: '1 1 320px' }}>
            <div style={{ fontSize: 14, color: '#556', marginBottom: 4 }}>Project Main · 실시간 DB 관리</div>
            <h1 style={{ margin: 0, fontSize: 30, color: '#1f2937' }}>프로젝트 DB 운영</h1>
            <p style={{ margin: '8px 0 0', color: '#475467', lineHeight: 1.6 }}>
              backend/pjt_db 폴더에 있는 DB 파일을 API로 실시간 관리합니다. 생성 · 복사 · 이름변경 · 삭제 모두 여기에서 실행하세요.
            </p>
          </div>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>새 프로젝트 DB 생성</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="예: BIM 표준 2026"
            style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(15,23,42,0.2)', fontSize: 14 }}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={actionPending}
          style={{ borderRadius: 8, border: 'none', padding: '10px 18px', background: actionPending ? '#a5b4fc' : '#1d4ed8', color: '#fff', fontWeight: 600, cursor: actionPending ? 'not-allowed' : 'pointer' }}
        >
          생성
        </button>
        <button
          type="button"
          onClick={openBackupModal}
          disabled={actionPending}
          style={{
            borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.16)',
            padding: '10px 14px',
            background: '#fff',
            color: '#0f172a',
            fontWeight: 700,
            cursor: actionPending ? 'not-allowed' : 'pointer',
          }}
        >
          백업 폴더 보기
        </button>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {loadingList ? '프로젝트 DB 목록을 불러오는 중입니다…' : `총 ${totalCount}개 · 마지막 업데이트 ${lastUpdated} · 총 용량 ${totalSize}`}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>프로젝트 DB 목록</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {projectDbs.map((db) => (
            <article key={db.file_name} style={{ borderRadius: 10, border: '1px solid rgba(15,23,42,0.12)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => handleOpenProjectRoute(db)}
                disabled={actionPending}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  textAlign: 'left',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1f2937',
                  cursor: actionPending ? 'not-allowed' : 'pointer',
                }}
                title="프로젝트 편집 열기"
              >
                {db.display_name}
              </button>
              <div style={{ fontSize: 12, color: '#475467' }}>파일: {db.file_name}</div>
              <div style={{ fontSize: 12, color: '#475467' }}>생성일: {formatDate(db.created_at)} · 크기: {formatBytes(db.size)}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: '#e0e7ff', color: '#1d4ed8', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  disabled={actionPending}
                  onClick={() => handleCopy(db.file_name, db.display_name)}
                >
                  복사
                </button>
                <button
                  style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: '#e0e7ff', color: '#1d4ed8', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  disabled={actionPending}
                  onClick={() => handleBackup(db.file_name, db.display_name)}
                >
                  백업
                </button>
                <button
                  style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: '#e0f2fe', color: '#0f172a', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  disabled={actionPending}
                  onClick={() => startRename(db)}
                >
                  이름변경
                </button>
                <button
                  style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  disabled={actionPending}
                  onClick={() => handleDelete(db.file_name, db.display_name)}
                >
                  삭제
                </button>
              </div>
              {renameTarget === db.file_name && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="새 이름"
                    style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', fontSize: 12 }}
                  />
                  <button
                    style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: '#14b8a6', color: '#fff', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                    disabled={actionPending}
                    onClick={commitRename}
                  >
                    저장
                  </button>
                  <button
                    style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '4px 8px', background: '#fff', color: '#0f172a', cursor: actionPending ? 'not-allowed' : 'pointer', fontSize: 12 }}
                    disabled={actionPending}
                    onClick={cancelRename}
                  >
                    취소
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {backupModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeBackupModal();
          }}
        >
          <div
            style={{
              width: 'min(980px, 100%)',
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 18px 60px rgba(15,23,42,0.25)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: '85vh',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>백업 DB 목록</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>backend/pjt_db/backup 폴더</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={fetchBackups}
                  disabled={loadingBackups || actionPending}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(15,23,42,0.16)',
                    background: '#fff',
                    fontWeight: 700,
                    cursor: loadingBackups || actionPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={closeBackupModal}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(15,23,42,0.16)',
                    background: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
              </div>
            </div>

            <div style={{ overflow: 'auto', border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>이름</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>파일</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>생성일</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>크기</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }} />
                  </tr>
                </thead>
                <tbody>
                  {loadingBackups ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: '#64748b' }}>
                        불러오는 중...
                      </td>
                    </tr>
                  ) : backupItems.length ? (
                    backupItems.map((item) => (
                      <tr key={item.file_name} style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{item.display_name}</td>
                        <td style={{ padding: '10px 12px', color: '#334155', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{item.file_name}</td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{formatBytes(item.size || 0)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handlePromoteBackup(item.file_name, item.display_name)}
                            disabled={actionPending}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#2563eb',
                              color: '#fff',
                              fontWeight: 800,
                              cursor: actionPending ? 'not-allowed' : 'pointer',
                            }}
                          >
                            프로젝트로 만들기
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: '#64748b' }}>
                        백업 파일이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#475467' }}>삭제를 실행하려면 admin 키를 입력하세요 (KEY: {ADMIN_KEY})</div>
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin 키 입력"
          style={{ padding: 6, borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', width: 160 }}
        />
      </section>

      {status && (
        <div style={{ padding: 10, borderRadius: 8, fontSize: 13, ...statusStyle }}>
          {status.message}
        </div>
      )}
    </div>
  );
}

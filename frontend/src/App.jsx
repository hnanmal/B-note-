import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css'
import { API_BASE_URL } from './apiConfig';
import WorkMasterManager from './components/WorkMasterManager';
import StandardGwmMatcher from './components/StandardGwmMatcher';
import StandardTreeManager from './components/StandardTreeManager';
import ProjectPage from './components/ProjectPage';
import CommonInputPage from './components/CommonInputPage';
import TeamStandardFamilyList from './components/TeamStandardFamilyList';

const NAV_ITEMS = [
  { id: 'workmaster', label: '워크마스터 매니저', icon: '🧰' },
  { id: 'matching', label: 'Team Standard Matching', icon: '🧩' },
];

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePage, setActivePage] = useState('matching'); // 'matching' | 'workmaster' | 'project' | 'common'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [calcDictionaryEntries, setCalcDictionaryEntries] = useState([]);
  const [calcDictionaryLoading, setCalcDictionaryLoading] = useState(false);
  const [calcDictionaryError, setCalcDictionaryError] = useState(null);
  const [calcDictionarySyncStatus, setCalcDictionarySyncStatus] = useState(null);
  const [calcDictionarySyncLoading, setCalcDictionarySyncLoading] = useState(false);
  const [editingCalcEntryId, setEditingCalcEntryId] = useState(null);
  const [editingCalcEntryValues, setEditingCalcEntryValues] = useState({
    calc_code: '',
    symbol_key: '',
    symbol_value: '',
  });
  const [savingCalcEntryId, setSavingCalcEntryId] = useState(null);
  const containerRef = useRef(null);
  const SIDEBAR_OPEN_WIDTH = 180;
  const SIDEBAR_COLLAPSED_WIDTH = 64;
  const PANEL_LEFT_WIDTH = 560;
  const fetchCalcDictionaryIndex = useCallback(async () => {
    setCalcDictionaryLoading(true);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/calc-dictionary`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.detail || body?.message || '전체 Calc Dictionary를 불러오지 못했습니다.';
        throw new Error(message);
      }
      const payload = await response.json().catch(() => []);
      setCalcDictionaryEntries(Array.isArray(payload) ? payload : []);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : '전체 Calc Dictionary를 불러오지 못했습니다.';
      setCalcDictionaryError(message);
    } finally {
      setCalcDictionaryLoading(false);
    }
  }, []);

  const syncCalcDictionaryWithCommonInput = useCallback(async () => {
    setCalcDictionarySyncLoading(true);
    setCalcDictionarySyncStatus(null);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/calc-dictionary/sync-with-common-input`, {
        method: 'POST',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'Common Info 데이터를 가져오지 못했습니다.';
        throw new Error(message);
      }
      const payload = await response.json().catch(() => null);
      const updated = typeof payload?.updated_entries === 'number' ? payload.updated_entries : 0;
      setCalcDictionarySyncStatus({
        type: 'success',
        message:
          updated > 0
            ? `${updated}개 항목을 Common Input 값으로 업데이트했습니다.`
            : '동기화할 항목이 없습니다.',
      });
      await fetchCalcDictionaryIndex();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Common Info와 동기화하는 중 오류가 발생했습니다.';
      setCalcDictionarySyncStatus({ type: 'error', message });
    } finally {
      setCalcDictionarySyncLoading(false);
    }
  }, [fetchCalcDictionaryIndex]);

  const openCalcDictionaryPage = useCallback(() => {
    setActivePage('calcDictionary');
  }, []);

  const startEditingCalcEntry = useCallback((entry) => {
    setEditingCalcEntryId(entry.id);
    setEditingCalcEntryValues({
      calc_code: entry.calc_code ?? '',
      symbol_key: entry.symbol_key ?? '',
      symbol_value: entry.symbol_value ?? '',
    });
    setCalcDictionaryError(null);
  }, []);

  const cancelEditingCalcEntry = useCallback(() => {
    setEditingCalcEntryId(null);
    setEditingCalcEntryValues({ calc_code: '', symbol_key: '', symbol_value: '' });
  }, []);

  const handleCalcEntryFieldChange = useCallback((field, value) => {
    setEditingCalcEntryValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const saveEditedCalcEntry = useCallback(async () => {
    if (!editingCalcEntryId) return;
    setSavingCalcEntryId(editingCalcEntryId);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/calc-dictionary/${editingCalcEntryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCalcEntryValues),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'Calc Dictionary 항목을 저장하지 못했습니다.';
        throw new Error(message);
      }
      await response.json();
      setEditingCalcEntryId(null);
      await fetchCalcDictionaryIndex();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calc Dictionary 항목을 저장하지 못했습니다.';
      setCalcDictionaryError(message);
    } finally {
      setSavingCalcEntryId(null);
    }
  }, [editingCalcEntryId, editingCalcEntryValues, fetchCalcDictionaryIndex]);

  useEffect(() => {
    if (activePage !== 'calcDictionary') return;
    fetchCalcDictionaryIndex();
  }, [activePage, fetchCalcDictionaryIndex]);

  useEffect(() => {
    if (activePage !== 'calcDictionary' && editingCalcEntryId) {
      cancelEditingCalcEntry();
    }
  }, [activePage, editingCalcEntryId, cancelEditingCalcEntry]);

  useEffect(() => {
    if (activePage !== 'calcDictionary') {
      setCalcDictionarySyncStatus(null);
    }
  }, [activePage]);

  return (
    <div className="App" style={{ height: 'calc(100vh - 1.5rem)', width: 'calc(100vw - 2rem)', minWidth: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <header className="App-header-fixed">
        <div className="app-title">B-note+</div>
      </header>
  <div style={{ height: 32 }} />
      <main className="App-main" ref={containerRef} style={{ display: 'flex', height: 'calc(100% - 64px)', flex: 1, minWidth: 0, overflowX: 'hidden' }}>
  {/* Sidebar: Only navigation, toggleable, fixed to left */}
        <div
          className={`sidebar-nav${sidebarOpen ? '' : ' collapsed'}`}
          style={{
            width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            minWidth: sidebarOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            maxWidth: sidebarOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            transition: 'width 0.2s',
            background: 'rgba(246, 217, 117, 0.25)',
            borderRight: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            height: 'calc(100% - 64px)',
            zIndex: 10,
          }}
        >
          <button
            className="sidebar-toggle-btn"
            style={{
              position: 'absolute',
              top: 12,
              right: sidebarOpen ? -18 : (SIDEBAR_COLLAPSED_WIDTH - 36) / 2,
              zIndex: 11,
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          >
            <span style={{ lineHeight: 1 }}>☰</span>
          </button>
          {sidebarOpen ? (
            <nav className="side-nav" style={{ marginTop: 56, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#555', textAlign: 'center' }}>팀BIM Admin</div>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  className={`nav-btn${activePage === item.id ? ' active' : ''}`}
                  onClick={() => setActivePage(item.id)}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    padding: '4px 0',
                    fontWeight: 600,
                    fontSize: 12,
                    border: 'none',
                    background: activePage === item.id ? '#f7c748' : '#f1f1f1',
                    color: activePage === item.id ? '#2c1b00' : '#1d4ed8',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  onClick={openCalcDictionaryPage}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    padding: '6px 0',
                    fontWeight: 600,
                    fontSize: 13,
                    border: 'none',
                    borderRadius: 8,
                    background: '#e2e8f0',
                    color: '#111827',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  전체 Calc Dictionary
                </button>
              </div>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setActivePage('common')}
                  className={`nav-btn${activePage === 'common' ? ' active' : ''}`}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    padding: '6px 0',
                    fontWeight: 600,
                    fontSize: 13,
                    border: 'none',
                    background: activePage === 'common' ? '#f7c748' : '#f1f1f1',
                    color: activePage === 'common' ? '#2c1b00' : '#1d4ed8',
                    cursor: 'pointer',
                  }}
                >
                  Common Input Setting
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('family')}
                  className={`nav-btn${activePage === 'family' ? ' active' : ''}`}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    padding: '6px 0',
                    fontWeight: 600,
                    fontSize: 13,
                    border: 'none',
                    background: activePage === 'family' ? '#f7c748' : '#f1f1f1',
                    color: activePage === 'family' ? '#2c1b00' : '#1d4ed8',
                    cursor: 'pointer',
                  }}
                >
                  Team Standard Family List
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Project User</div>
                <button
                  type="button"
                  onClick={() => setActivePage('project')}
                  style={{
                    width: '80%',
                    padding: '6px 0',
                    borderRadius: 8,
                    border: '1px solid #f7c748',
                    background: activePage === 'project' ? '#f7c748' : '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    textAlign: 'center',
                    fontSize: 13,
                    color: activePage === 'project' ? '#2c1b00' : '#1d4ed8',
                  }}
                >
                  Project Main
                </button>
              </div>
            </nav>
          ) : (
            <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>BIM Admin</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {NAV_ITEMS.map(item => (
                    <button
                      key={item.id}
                      className={`nav-btn icon${activePage === item.id ? ' active' : ''}`}
                      onClick={() => setActivePage(item.id)}
                      style={{
                        width: 32,
                        height: 32,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 600,
                        color: activePage === item.id ? '#222' : '#1d4ed8',
                        borderRadius: 6,
                        transition: 'background 0.2s',
                      }}
                      aria-label={item.label}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>Calc</div>
                <button
                  type="button"
                  onClick={openCalcDictionaryPage}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #cbd5f5',
                    background: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    textAlign: 'center',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1d4ed8',
                  }}
                  aria-label="Calc Dictionary"
                >
                  Σ
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>Project User</div>
                <button
                  type="button"
                  onClick={() => setActivePage('project')}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #f7c748',
                    background: activePage === 'project' ? '#f7c748' : '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    textAlign: 'center',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: activePage === 'project' ? '#2c1b00' : '#1d4ed8',
                  }}
                >
                  P
                </button>
              </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>Common</div>
                  <button
                    type="button"
                    onClick={() => setActivePage('common')}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid #f7c748',
                      background: activePage === 'common' ? '#f7c748' : '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      textAlign: 'center',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activePage === 'common' ? '#2c1b00' : '#1d4ed8',
                    }}
                    aria-label="Common Input Setting"
                  >
                    C
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>Family</div>
                  <button
                    type="button"
                    onClick={() => setActivePage('family')}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid #f7c748',
                      background: activePage === 'family' ? '#f7c748' : '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      textAlign: 'center',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activePage === 'family' ? '#2c1b00' : '#1d4ed8',
                    }}
                    aria-label="Team Standard Family List"
                  >
                    F
                  </button>
                </div>
            </div>
          )}
        </div>

        {activePage === 'calcDictionary' ? (
          <div className="panel calc-dictionary" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0, height: '100%' }}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '20px 24px',
                  boxShadow: '0 15px 25px rgba(15,23,42,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>전체 Calc Dictionary</span>
                    <button
                      type="button"
                      onClick={syncCalcDictionaryWithCommonInput}
                      disabled={calcDictionarySyncLoading}
                      style={{
                        border: '1px solid #2563eb',
                        background: calcDictionarySyncLoading ? '#93c5fd' : '#2563eb',
                        color: '#fff',
                        fontWeight: 600,
                        padding: '4px 12px',
                        borderRadius: 8,
                        cursor: calcDictionarySyncLoading ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {calcDictionarySyncLoading ? '동기화 중...' : 'Common Info 로부터 업데이트'}
                    </button>
                  </div>
                  {calcDictionarySyncStatus && (
                    <div
                      style={{
                        fontSize: 12,
                        color: calcDictionarySyncStatus.type === 'error' ? '#b91c1c' : '#047857',
                      }}
                    >
                      {calcDictionarySyncStatus.message}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#475467' }}>
                    Family 항목과 심벌 키/값을 한번에 확인합니다.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setActivePage('matching')}
                    style={{
                      border: '1px solid #cbd5f5',
                      background: '#fff',
                      color: '#1d4ed8',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    목록으로 돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={fetchCalcDictionaryIndex}
                    style={{
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    새로고침
                  </button>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {calcDictionaryLoading ? (
                  <div style={{ fontSize: 12, color: '#0f172a' }}>
                    전체 Calc Dictionary를 불러오는 중입니다...
                  </div>
                ) : calcDictionaryError ? (
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>{calcDictionaryError}</div>
                ) : calcDictionaryEntries.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    등록된 Calc Dictionary 항목이 없습니다.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 90px 1fr 1fr 1fr 140px',
                        gap: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475467',
                        borderBottom: '1px solid #e5e7eb',
                        paddingBottom: 6,
                      }}
                    >
                      <span>Sequence</span>
                      <span>Family</span>
                      <span>Type</span>
                      <span>Calc Code</span>
                      <span>Symbol Key</span>
                      <span>Symbol Value</span>
                      <span style={{ textAlign: 'right' }}>작업</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {calcDictionaryEntries.map((entry) => {
                        const isEditing = editingCalcEntryId === entry.id;
                        return (
                          <div
                            key={entry.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px 1fr 90px 1fr 1fr 1fr 140px',
                              gap: 12,
                              fontSize: 11,
                              color: '#0f172a',
                              padding: '6px 0',
                              borderBottom: '1px solid #f1f5f9',
                              alignItems: 'center',
                            }}
                          >
                            <span>{entry.family_item?.sequence_number || '—'}</span>
                            <span>{entry.family_item?.name || '—'}</span>
                            <span>{entry.family_item?.item_type || '—'}</span>
                            <span>
                              {isEditing ? (
                                <input
                                  value={editingCalcEntryValues.calc_code}
                                  onChange={(event) => handleCalcEntryFieldChange('calc_code', event.target.value)}
                                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}
                                />
                              ) : (
                                <span style={{ fontWeight: 600 }}>{entry.calc_code || '—'}</span>
                              )}
                            </span>
                            <span>
                              {isEditing ? (
                                <input
                                  value={editingCalcEntryValues.symbol_key}
                                  onChange={(event) => handleCalcEntryFieldChange('symbol_key', event.target.value)}
                                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}
                                />
                              ) : (
                                entry.symbol_key
                              )}
                            </span>
                            <span>
                              {isEditing ? (
                                <input
                                  value={editingCalcEntryValues.symbol_value}
                                  onChange={(event) => handleCalcEntryFieldChange('symbol_value', event.target.value)}
                                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}
                                />
                              ) : (
                                entry.symbol_value
                              )}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={saveEditedCalcEntry}
                                    disabled={savingCalcEntryId === entry.id}
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #2563eb',
                                      background: savingCalcEntryId === entry.id ? '#93c5fd' : '#2563eb',
                                      color: '#fff',
                                      fontSize: 11,
                                      cursor: savingCalcEntryId === entry.id ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {savingCalcEntryId === entry.id ? '저장 중...' : '저장'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingCalcEntry}
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5f5',
                                      background: '#fff',
                                      fontSize: 11,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingCalcEntry(entry)}
                                  style={{
                                    padding: '2px 10px',
                                    borderRadius: 4,
                                    border: '1px solid #cbd5f5',
                                    background: '#fff',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activePage === 'project' ? (
          <div className="panel project" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectPage />
          </div>
        ) : activePage === 'common' ? (
          <div className="panel pick" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <CommonInputPage />
          </div>
        ) : activePage === 'family' ? (
          <div className="panel family" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <TeamStandardFamilyList />
          </div>
        ) : (
          <>
            {/* Left panel: StandardTreeManager or WorkMasterManager */}
            <div
              className="panel left"
              style={activePage === 'matching' ? {
                width: PANEL_LEFT_WIDTH,
                minWidth: 0,
                flex: '0 0 ' + PANEL_LEFT_WIDTH + 'px',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100% - 64px)',
                position: 'relative',
                zIndex: 1,
                overflowX: 'hidden',
              } : {
                flex: '1 1 auto',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100% - 64px)',
                position: 'relative',
                zIndex: 1,
                overflowX: 'hidden',
              }}
            >
              <div style={{ flex: 1, overflow: 'auto', padding: '0 0 0 8px', minWidth: 0 }}>
                {activePage === 'matching' ? (
                  <StandardTreeManager onNodeSelect={setSelectedNode} refreshSignal={treeRefreshKey} />
                ) : (
                  <WorkMasterManager />
                )}
              </div>
            </div>

            {/* Right panel: Matching UI or info */}
            {activePage === 'matching' && (
              <div className="panel right" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflowX: 'hidden' }}>
                <div className="right-top" style={{ height: '100%', minWidth: 0 }}>
                  <StandardGwmMatcher selectedNode={selectedNode} onTreeRefresh={() => setTreeRefreshKey((prev) => prev + 1)} />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App


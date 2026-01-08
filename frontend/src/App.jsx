import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css'
import { API_BASE_URL } from './apiConfig';
import WorkMasterManager from './components/WorkMasterManager';
import StandardGwmMatcher from './components/StandardGwmMatcher';
import StandardTreeManager from './components/StandardTreeManager';
import ProjectPage from './components/ProjectPage';
import CommonInputPage from './components/CommonInputPage';
import TeamStandardFamilyList from './components/TeamStandardFamilyList';
import ProjectInputMain from './components/ProjectInputMain';
import ProjectFamilyAssign from './components/ProjectFamilyAssign';
import ProjectInteriorMatrix from './components/ProjectInteriorMatrix';
import ProjectStandardSelect from './components/ProjectStandardSelect';
import ProjectWmSummary from './components/ProjectWmSummary';
import ProjectWmPrecheck from './components/ProjectWmPrecheck';
import ProjectMain from './components/ProjectMain';

const NAV_ITEMS = [
  { id: 'workmaster', label: '워크마스터 매니저', icon: '🧰' },
  { id: 'matching', label: 'Team Standard Matching', icon: '🧩' },
  { id: 'wm-precheck', label: 'WM pre-check', icon: '✅' },
  { id: 'select', label: 'Standard Select', icon: '✨' },
  { id: 'wm-summary', label: 'WM Summary', icon: '📋' },
];
const PROJECT_ROUTE_PREFIX = '/project';

function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const routeSuffix = pathname.startsWith(`${PROJECT_ROUTE_PREFIX}/`)
    ? pathname.slice(PROJECT_ROUTE_PREFIX.length + 1)
    : '';
  const [rawProjectIdentifier] = routeSuffix.split('/').filter(Boolean);
  const projectRouteIdentifier = rawProjectIdentifier ? decodeURIComponent(rawProjectIdentifier) : '';
  const isProjectEditorRoute = Boolean(projectRouteIdentifier);
  const isTeamEntryRoute = !isProjectEditorRoute;

  const [selectedNode, setSelectedNode] = useState(null);
  const [activePage, setActivePage] = useState(isProjectEditorRoute ? 'project-main' : 'project');
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
  const [familyListIndex, setFamilyListIndex] = useState([]);
  const [familyListIndexLoading, setFamilyListIndexLoading] = useState(false);
  const [addingCalcEntry, setAddingCalcEntry] = useState(false);
  const [newCalcEntryValues, setNewCalcEntryValues] = useState({
    family_list_id: '',
    calc_code: '프리셋',
    symbol_key: '',
    symbol_value: '',
  });
  const [deletingCalcEntryId, setDeletingCalcEntryId] = useState(null);
  const containerRef = useRef(null);
  const SIDEBAR_OPEN_WIDTH = 180;
  const SIDEBAR_COLLAPSED_WIDTH = 64;
  const PANEL_LEFT_WIDTH = 560;
  const projectApiBase = isProjectEditorRoute
    ? `${API_BASE_URL}/project/${encodeURIComponent(projectRouteIdentifier)}`
    : API_BASE_URL;

  const [exportingDynamoJson, setExportingDynamoJson] = useState(false);
  const downloadDynamoJson = useCallback(async () => {
    if (!isProjectEditorRoute || !projectRouteIdentifier) return;
    if (!projectApiBase) return;
    if (exportingDynamoJson) return;

    setExportingDynamoJson(true);
    try {
      const response = await fetch(`${projectApiBase}/export/db-json`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'Dynamo JSON을 추출하지 못했습니다.';
        throw new Error(message);
      }
      const payload = await response.json();
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const safeProject = (projectRouteIdentifier ?? 'project').replace(/[\\/:*?"<>|]+/g, '_');
      const filename = `dynamo_export_${safeProject}_${stamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dynamo JSON을 추출하지 못했습니다.';
      alert(message);
    } finally {
      setExportingDynamoJson(false);
    }
  }, [exportingDynamoJson, isProjectEditorRoute, projectApiBase, projectRouteIdentifier]);

  const [exportingDbExcel, setExportingDbExcel] = useState(false);
  const downloadDbExcel = useCallback(async () => {
    if (!isProjectEditorRoute || !projectRouteIdentifier) return;
    if (!projectApiBase) return;
    if (exportingDbExcel) return;

    setExportingDbExcel(true);
    try {
      const response = await fetch(`${projectApiBase}/export/db-excel`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'DB 엑셀 보고서를 생성하지 못했습니다.';
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const header = response.headers.get('Content-Disposition') || '';
      const match = header.match(/filename="?([^";]+)"?/i);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const safeProject = (projectRouteIdentifier ?? 'project').replace(/[\\/:*?"<>|]+/g, '_');
      const filename = match?.[1] || `db_report_${safeProject}_${stamp}.xlsx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DB 엑셀 보고서를 생성하지 못했습니다.';
      alert(message);
    } finally {
      setExportingDbExcel(false);
    }
  }, [exportingDbExcel, isProjectEditorRoute, projectApiBase, projectRouteIdentifier]);
  const navLabelOverrides = {
    workmaster: isProjectEditorRoute ? '프로젝트 워크마스터 매니저' : '워크마스터 매니저',
    matching: isProjectEditorRoute ? '프로젝트 Standard Matching' : 'Team Standard Matching',
    select: isProjectEditorRoute ? '프로젝트 Standard Select' : 'Team Standard Select',
    'wm-summary': 'WM Summary',
    'wm-precheck': 'WM pre-check',
  };
  const navItems = isProjectEditorRoute
    ? [{ id: 'project-main', label: 'Project Main', icon: '🏠' }, ...NAV_ITEMS]
    : [];
  const activeNavItems = navItems.map((item) => ({
    ...item,
    label: navLabelOverrides[item.id] ?? item.label,
  }));
  const adminLabel = isProjectEditorRoute ? 'Project Standard' : '팀BIM Admin';
  const commonButtonLabel = isProjectEditorRoute ? '프로젝트 Common Input' : 'Common Input Setting';
  const calcButtonLabel = isProjectEditorRoute ? '프로젝트 전체 Calc Dictionary' : '전체 Calc Dictionary';
  const familyButtonLabel = isProjectEditorRoute ? '프로젝트 Standard Family List' : 'Team Standard Family List';
  const groupLabelStyle = { fontSize: 10, letterSpacing: 1, color: '#555', textAlign: 'center' };
  const headerStyle = {
    background: isProjectEditorRoute ? '#d6c7ff' : '#f6d975',
    borderBottom: isProjectEditorRoute ? '1px solid #b59ae9' : '#e0c34d',
  };
  const commonAriaLabel = commonButtonLabel;
  const calcAriaLabel = calcButtonLabel;
  const familyAriaLabel = familyButtonLabel;
  const standardGroupLabel = isProjectEditorRoute ? 'Project Standard' : 'Team Standard';
  const headerTitle = isProjectEditorRoute && projectRouteIdentifier
    ? `B-note+ · ${projectRouteIdentifier}`
    : 'B-note+';
  const projectInputPages = {
    'project-input-main': 'Project Input Main',
    'project-input-family': 'Project Family Assign',
    'project-input-interior': 'Project Interior Matrix',
  };
  const fetchCalcDictionaryIndex = useCallback(async () => {
    setCalcDictionaryLoading(true);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${projectApiBase}/calc-dictionary`);
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
  }, [projectApiBase]);

  const syncCalcDictionaryWithCommonInput = useCallback(async () => {
    setCalcDictionarySyncLoading(true);
    setCalcDictionarySyncStatus(null);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${projectApiBase}/calc-dictionary/sync-with-common-input`, {
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
  }, [fetchCalcDictionaryIndex, projectApiBase]);

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
      const payload = {
        ...editingCalcEntryValues,
        calc_code: editingCalcEntryValues.calc_code.trim() ? editingCalcEntryValues.calc_code : null,
      };
      const response = await fetch(`${projectApiBase}/calc-dictionary/${editingCalcEntryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
  }, [editingCalcEntryId, editingCalcEntryValues, fetchCalcDictionaryIndex, projectApiBase]);

  const fetchFamilyListIndex = useCallback(async () => {
    setFamilyListIndexLoading(true);
    try {
      const response = await fetch(`${projectApiBase}/family-list/`);
      if (!response.ok) throw new Error('Family List를 불러오지 못했습니다.');
      const payload = await response.json().catch(() => []);
      const list = Array.isArray(payload) ? payload : [];
      list.sort((a, b) => {
        const seqA = (a?.sequence_number ?? '').toString();
        const seqB = (b?.sequence_number ?? '').toString();
        if (seqA && seqB && seqA !== seqB) return seqA.localeCompare(seqB);
        if (seqA && !seqB) return -1;
        if (!seqA && seqB) return 1;
        const nameA = (a?.name ?? '').toString();
        const nameB = (b?.name ?? '').toString();
        return nameA.localeCompare(nameB);
      });
      setFamilyListIndex(list);
    } catch {
      setFamilyListIndex([]);
    } finally {
      setFamilyListIndexLoading(false);
    }
  }, [projectApiBase]);

  const handleNewCalcEntryFieldChange = useCallback((field, value) => {
    setNewCalcEntryValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addCalcDictionaryEntry = useCallback(async () => {
    if (addingCalcEntry) return;
    const symbolKey = newCalcEntryValues.symbol_key.trim();
    const symbolValue = newCalcEntryValues.symbol_value.trim();
    if (!symbolKey || !symbolValue) {
      setCalcDictionaryError('Symbol Key/Value는 필수입니다.');
      return;
    }
    setAddingCalcEntry(true);
    setCalcDictionaryError(null);
    try {
      const familyIdRaw = newCalcEntryValues.family_list_id;
      const familyId = Number(familyIdRaw);
      const hasFamily = Number.isFinite(familyId) && familyId > 0;
      const nextCalcCodeRaw = newCalcEntryValues.calc_code.trim();
      const payload = {
        family_list_id: hasFamily ? familyId : null,
        calc_code: hasFamily
          ? (nextCalcCodeRaw ? nextCalcCodeRaw : null)
          : (nextCalcCodeRaw ? nextCalcCodeRaw : '프리셋'),
        symbol_key: symbolKey,
        symbol_value: symbolValue,
      };
      const response = await fetch(`${projectApiBase}/calc-dictionary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'Calc Dictionary 항목을 추가하지 못했습니다.';
        throw new Error(message);
      }
      await response.json();
      setNewCalcEntryValues({ family_list_id: '', calc_code: '프리셋', symbol_key: '', symbol_value: '' });
      await fetchCalcDictionaryIndex();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calc Dictionary 항목을 추가하지 못했습니다.';
      setCalcDictionaryError(message);
    } finally {
      setAddingCalcEntry(false);
    }
  }, [addingCalcEntry, fetchCalcDictionaryIndex, newCalcEntryValues, projectApiBase]);

  const deleteCalcDictionaryEntry = useCallback(async (entryId) => {
    if (!entryId) return;
    if (deletingCalcEntryId) return;
    setDeletingCalcEntryId(entryId);
    setCalcDictionaryError(null);
    try {
      const response = await fetch(`${projectApiBase}/calc-dictionary/${entryId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.detail || body?.message || 'Calc Dictionary 항목을 삭제하지 못했습니다.';
        throw new Error(message);
      }
      await response.json();
      if (editingCalcEntryId === entryId) {
        setEditingCalcEntryId(null);
      }
      await fetchCalcDictionaryIndex();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calc Dictionary 항목을 삭제하지 못했습니다.';
      setCalcDictionaryError(message);
    } finally {
      setDeletingCalcEntryId(null);
    }
  }, [deletingCalcEntryId, editingCalcEntryId, fetchCalcDictionaryIndex, projectApiBase]);

  useEffect(() => {
    if (activePage !== 'calcDictionary') return;
    fetchCalcDictionaryIndex();
    fetchFamilyListIndex();
  }, [activePage, fetchCalcDictionaryIndex, fetchFamilyListIndex]);

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

  useEffect(() => {
    if (isTeamEntryRoute && activePage !== 'project') {
      setActivePage('project');
    }
  }, [isTeamEntryRoute, activePage]);

  return (
    <div className="App" style={{ height: 'calc(100vh - 1rem)', width: 'calc(100vw - 2rem)', minWidth: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <header className="App-header-fixed" style={headerStyle}>
        <div className="app-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{headerTitle}</span>
          {isProjectEditorRoute && projectRouteIdentifier ? (
            <>
              <button
                type="button"
                onClick={downloadDbExcel}
                disabled={!projectApiBase || exportingDbExcel}
                style={{
                  height: 20,
                  padding: '0 7px',
                  borderRadius: 8,
                  border: '0.5px solid #2563eb',
                  background: !projectApiBase || exportingDbExcel ? '#bfdbfe' : '#2563eb',
                  color: '#0b1020',
                  fontWeight: 800,
                  cursor: !projectApiBase || exportingDbExcel ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  lineHeight: 1,
                }}
                title="프로젝트 DB 전체 내용을 Excel 보고서로 다운로드"
              >
                {exportingDbExcel ? '엑셀 생성 중...' : 'DB Excel'}
              </button>
              <button
                type="button"
                onClick={downloadDynamoJson}
                disabled={!projectApiBase || exportingDynamoJson}
                style={{
                  height: 20,
                  padding: '0 7px',
                  borderRadius: 8,
                  border: '0.5px solid #10b981',
                  background: !projectApiBase || exportingDynamoJson ? '#bbf7d0' : '#10b981',
                  color: '#052e16',
                  fontWeight: 800,
                  cursor: !projectApiBase || exportingDynamoJson ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  lineHeight: 1,
                }}
                title="프로젝트 DB 내용을 Dynamo 테스트용 JSON으로 다운로드"
              >
                {exportingDynamoJson ? 'JSON 생성 중...' : 'Dynamo JSON'}
              </button>
            </>
          ) : null}
        </div>
      </header>
  <div style={{ height: 6 }} />
      <main className="App-main" ref={containerRef} style={{ display: 'flex', height: 'calc(100% - 30px)', flex: 1, minWidth: 0, overflowX: 'hidden' }}>
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
            height: 'calc(100% - 30px)',
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
            <nav className="side-nav" style={{ marginTop: 56, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              {isTeamEntryRoute ? (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ ...groupLabelStyle, fontWeight: 600 }}>Project User &gt;</div>
                  <button
                    type="button"
                    onClick={() => setActivePage('project')}
                    style={{
                      width: '80%',
                      padding: '8px 0',
                      borderRadius: 8,
                      border: '1px solid #f7c748',
                      background: '#f7c748',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: 13,
                      color: '#2c1b00',
                    }}
                  >
                    Project Select
                  </button>
                </div>
              ) : (
                <>
                  <div style={groupLabelStyle}>{standardGroupLabel} &gt;</div>
                  {activeNavItems.map(item => (
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
                  <div style={{ marginTop: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12 }}>
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
                      {commonButtonLabel}
                    </button>
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
                      {calcButtonLabel}
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
                      {familyButtonLabel}
                    </button>
                  </div>
                  {isProjectEditorRoute && (
                    <>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', ...groupLabelStyle }}>
                        <span>Project Input &gt;</span>
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setActivePage('project-input-main')}
                          className={`nav-btn${activePage === 'project-input-main' ? ' active' : ''}`}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            maxWidth: '100%',
                            padding: '6px 0',
                            fontWeight: 600,
                            fontSize: 13,
                            border: 'none',
                            background: activePage === 'project-input-main' ? '#f7c748' : '#f1f1f1',
                            color: activePage === 'project-input-main' ? '#2c1b00' : '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          Project Input Main
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePage('project-input-family')}
                          className={`nav-btn${activePage === 'project-input-family' ? ' active' : ''}`}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            maxWidth: '100%',
                            padding: '6px 0',
                            fontWeight: 600,
                            fontSize: 13,
                            border: 'none',
                            background: activePage === 'project-input-family' ? '#f7c748' : '#f1f1f1',
                            color: activePage === 'project-input-family' ? '#2c1b00' : '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          Project Family Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePage('project-input-interior')}
                          className={`nav-btn${activePage === 'project-input-interior' ? ' active' : ''}`}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            maxWidth: '100%',
                            padding: '6px 0',
                            fontWeight: 600,
                            fontSize: 13,
                            border: 'none',
                            background: activePage === 'project-input-interior' ? '#f7c748' : '#f1f1f1',
                            color: activePage === 'project-input-interior' ? '#2c1b00' : '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          Project Interior Matrix
                        </button>
                      </div>
                    </>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ ...groupLabelStyle, fontWeight: 600 }}>Project User &gt;</div>
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
                      Project Select
                    </button>
                  </div>
                </>
              )}
            </nav>
          ) : (
            <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              {isTeamEntryRoute ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>Project</div>
                  <button
                    type="button"
                    onClick={() => setActivePage('project')}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid #f7c748',
                      background: '#f7c748',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2c1b00',
                    }}
                    aria-label="Project Select"
                  >
                    P
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: '#444' }}>{adminLabel}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {activeNavItems.map(item => (
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
                      aria-label={commonAriaLabel}
                    >
                      C
                    </button>
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
                      aria-label={calcAriaLabel}
                    >
                      Σ
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
                      aria-label={familyAriaLabel}
                    >
                      F
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
                </>
              )}
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
                {(() => {
                  const visibleEntries = calcDictionaryEntries || [];

                  const selectedFamilyId = Number(newCalcEntryValues.family_list_id);
                  const selectedFamily = Number.isFinite(selectedFamilyId)
                    ? familyListIndex.find((item) => Number(item?.id) === selectedFamilyId)
                    : null;
                  const selectedSequence = selectedFamily?.sequence_number ?? '';
                  const selectedType = selectedFamily?.item_type ?? '';

                  return (
                    <>
                {calcDictionaryLoading ? (
                  <div style={{ fontSize: 12, color: '#0f172a' }}>
                    전체 Calc Dictionary를 불러오는 중입니다...
                  </div>
                ) : calcDictionaryError ? (
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>{calcDictionaryError}</div>
                ) : visibleEntries.length === 0 ? (
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
                        color: '#0f172a',
                        padding: '8px 0',
                        borderBottom: '1px solid #e5e7eb',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#64748b' }}>{selectedSequence || '—'}</span>
                      <span>
                        <select
                          value={newCalcEntryValues.family_list_id}
                          onChange={(event) => {
                            const nextId = event.target.value;
                            const nextItem = familyListIndex.find((item) => String(item?.id) === String(nextId));
                            const nextCalcCode = (nextItem?.sequence_number ?? '').toString().trim();
                            setNewCalcEntryValues((prev) => ({
                              ...prev,
                              family_list_id: nextId,
                              calc_code: nextId ? nextCalcCode : '프리셋',
                            }));
                          }}
                          disabled={familyListIndexLoading || addingCalcEntry}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                        >
                          <option value="">Family 선택</option>
                          {familyListIndex.map((item) => {
                            const id = item?.id;
                            const label = [item?.sequence_number, item?.name].filter(Boolean).join(' / ');
                            return (
                              <option key={id} value={id}>
                                {label || `ID ${id}`}
                              </option>
                            );
                          })}
                        </select>
                      </span>
                      <span style={{ color: '#64748b' }}>{selectedType || '—'}</span>
                      <span>
                        <input
                          value={newCalcEntryValues.calc_code}
                          onChange={(event) => handleNewCalcEntryFieldChange('calc_code', event.target.value)}
                          disabled={addingCalcEntry}
                          placeholder="Calc Code"
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                        />
                      </span>
                      <span>
                        <input
                          value={newCalcEntryValues.symbol_key}
                          onChange={(event) => handleNewCalcEntryFieldChange('symbol_key', event.target.value)}
                          disabled={addingCalcEntry}
                          placeholder="Symbol Key"
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                        />
                      </span>
                      <span>
                        <input
                          value={newCalcEntryValues.symbol_value}
                          onChange={(event) => handleNewCalcEntryFieldChange('symbol_value', event.target.value)}
                          disabled={addingCalcEntry}
                          placeholder="Symbol Value"
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                        />
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          type="button"
                          onClick={addCalcDictionaryEntry}
                          disabled={addingCalcEntry || familyListIndexLoading}
                          style={{
                            padding: '2px 10px',
                            borderRadius: 6,
                            border: '1px solid #2563eb',
                            background: addingCalcEntry ? '#93c5fd' : '#2563eb',
                            color: '#fff',
                            fontSize: 11,
                            cursor: addingCalcEntry || familyListIndexLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {addingCalcEntry ? '추가 중...' : '추가'}
                        </button>
                      </div>
                    </div>
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
                      {visibleEntries.map((entry) => {
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
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditingCalcEntry(entry)}
                                    disabled={Boolean(deletingCalcEntryId)}
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5f5',
                                      background: '#fff',
                                      fontSize: 11,
                                      cursor: deletingCalcEntryId ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteCalcDictionaryEntry(entry.id)}
                                    disabled={deletingCalcEntryId === entry.id}
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #ef4444',
                                      background: deletingCalcEntryId === entry.id ? '#fecaca' : '#fff',
                                      color: '#b91c1c',
                                      fontSize: 11,
                                      cursor: deletingCalcEntryId === entry.id ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {deletingCalcEntryId === entry.id ? '삭제 중...' : '삭제'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : projectInputPages[activePage] ? (
          activePage === 'project-input-main' ? (
            <div className="panel project-input" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
              <ProjectInputMain apiBaseUrl={projectApiBase} />
            </div>
          ) : activePage === 'project-input-family' ? (
            <div className="panel project-input" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
              <ProjectFamilyAssign apiBaseUrl={projectApiBase} />
            </div>
          ) : (
            <div className="panel project-input" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
              <ProjectInteriorMatrix apiBaseUrl={projectApiBase} />
            </div>
          )
        ) : activePage === 'project-main' ? (
          <div className="panel project-main" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectMain apiBaseUrl={projectApiBase} />
          </div>
        ) : activePage === 'select' ? (
          <div className="panel select" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectStandardSelect apiBaseUrl={projectApiBase} />
          </div>
        ) : activePage === 'wm-precheck' ? (
          <div className="panel wm-precheck" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectWmPrecheck apiBaseUrl={projectApiBase} />
          </div>
        ) : activePage === 'wm-summary' ? (
          <div className="panel wm-summary" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectWmSummary apiBaseUrl={projectApiBase} />
          </div>
        ) : activePage === 'project' ? (
          <div className="panel project" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <ProjectPage />
          </div>
        ) : activePage === 'common' ? (
          <div className="panel pick" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <CommonInputPage title={commonButtonLabel} apiBaseUrl={projectApiBase} />
          </div>
        ) : activePage === 'family' ? (
          <div className="panel family" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflow: 'hidden', padding: 16 }}>
            <TeamStandardFamilyList apiBaseUrl={projectApiBase} />
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
                  <StandardTreeManager
                    onNodeSelect={setSelectedNode}
                    refreshSignal={treeRefreshKey}
                    apiBaseUrl={projectApiBase}
                    hideDerivedItems
                    hideDeriveControls
                  />
                ) : (
                  <WorkMasterManager apiBaseUrl={projectApiBase} selectedFamilyNode={selectedNode?.node} />
                )}
              </div>
            </div>

            {/* Right panel: Matching UI or info */}
            {activePage === 'matching' && (
              <div className="panel right" style={{ flex: '1 1 auto', height: 'calc(100% - 64px)', position: 'relative', zIndex: 1, minWidth: 0, overflowX: 'hidden' }}>
                <div className="right-top" style={{ height: '100%', minWidth: 0 }}>
                  <StandardGwmMatcher selectedNode={selectedNode} onTreeRefresh={() => setTreeRefreshKey((prev) => prev + 1)} apiBaseUrl={projectApiBase} />
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


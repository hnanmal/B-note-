import React, { useState, useRef } from 'react';
import './App.css'
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
  const containerRef = useRef(null);
  const SIDEBAR_OPEN_WIDTH = 180;
  const SIDEBAR_COLLAPSED_WIDTH = 64;
  const PANEL_LEFT_WIDTH = 560;

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

        {activePage === 'project' ? (
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


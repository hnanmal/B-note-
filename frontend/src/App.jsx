import React, { useState, useRef, useEffect } from 'react';
import './App.css'
import WorkMasterManager from './components/WorkMasterManager';
import StandardGwmMatcher from './components/StandardGwmMatcher';
import StandardTreeManager from './components/StandardTreeManager';

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePage, setActivePage] = useState('matching'); // 'matching' | 'workmaster'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const containerRef = useRef(null);
  const SIDEBAR_WIDTH = 200;
  const PANEL_LEFT_WIDTH = 560;

  return (
    <div className="App" style={{ height: '100vh', width: '100vw', minWidth: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <header className="App-header-fixed">
        <div className="app-title">B-note+</div>
      </header>
      <div style={{ height: 64 }} />
      <main className="App-main" ref={containerRef} style={{ display: 'flex', height: 'calc(100vh - 64px)', flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {/* Sidebar: Only navigation, toggleable, fixed to left */}
        <div
          className={`sidebar-nav${sidebarOpen ? '' : ' collapsed'}`}
          style={{
            width: sidebarOpen ? SIDEBAR_WIDTH : 48,
            minWidth: sidebarOpen ? SIDEBAR_WIDTH : 48,
            maxWidth: sidebarOpen ? SIDEBAR_WIDTH : 48,
            transition: 'width 0.2s',
            background: '#f8f8f8',
            borderRight: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'left',
            position: 'sticky',
            height: '100%',
            zIndex: 10,
          }}
        >
          <button
            className="sidebar-toggle-btn"
            style={{
              position: 'absolute',
              top: 12,
              right: 8,
              zIndex: 11,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          >
            {sidebarOpen ? '<' : '>'}
          </button>
          {sidebarOpen && (
            <nav className="side-nav" style={{ marginTop: 56, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                className={`nav-btn${activePage === 'workmaster' ? ' active' : ''}`}
                onClick={() => setActivePage('workmaster')}
                style={{
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 0',
                  fontWeight: 600,
                  fontSize: 13,
                  border: 'none',
                  background: activePage === 'workmaster' ? '#e0e0e0' : 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                워크마스터 매니저
              </button>
              <button
                className={`nav-btn${activePage === 'matching' ? ' active' : ''}`}
                onClick={() => setActivePage('matching')}
                style={{
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 0',
                  fontWeight: 600,
                  fontSize: 13,
                  border: 'none',
                  background: activePage === 'matching' ? '#e0e0e0' : 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Team Standard Matching
              </button>
            </nav>
          )}
        </div>

        {/* Left panel: StandardTreeManager or WorkMasterManager, always visible, next to sidebar */}
        <div className="panel left" style={{
          width: PANEL_LEFT_WIDTH,
          minWidth: 0,
          flex: '0 0 ' + PANEL_LEFT_WIDTH + 'px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          zIndex: 1,
          overflowX: 'hidden',
        }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 0 0 8px', minWidth: 0 }}>
            {activePage === 'matching' ? (
              <StandardTreeManager onNodeSelect={setSelectedNode} />
            ) : (
              <WorkMasterManager />
            )}
          </div>
        </div>

        {/* Right panel: Matching UI or info */}
        <div className="panel right" style={{ flex: '1 1 auto', height: '100%', position: 'relative', zIndex: 1, minWidth: 0, overflowX: 'hidden' }}>
          <div className="right-top" style={{ height: '100%', minWidth: 0 }}>
            {activePage === 'matching' ? (
              <StandardGwmMatcher selectedNode={selectedNode} />
            ) : (
              <div style={{ padding: 32, color: '#888', fontSize: 18 }}>워크마스터 매니저 탭에서는 매칭 UI가 숨겨집니다.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App


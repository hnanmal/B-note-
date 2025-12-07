import React, { useEffect, useMemo, useState } from 'react';
import ProjectFamilyListWidget from './ProjectFamilyListWidget';

const WORK_MASTER_COLUMNS = ['Use', 'GWM', 'Item', '상세', '단위'];
const WORK_MASTER_ROWS = [
  { id: 1, discipline: 'GWM', item: '표준산출', detail: 'None', unit: 'EA' },
  { id: 2, discipline: 'SWM', item: '실물간편', detail: 'None', unit: 'EA' },
];

export default function ProjectFamilyAssign({ apiBaseUrl }) {
  const [buildings, setBuildings] = useState([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [revitTypeInput, setRevitTypeInput] = useState('');
  const [activeRevitIndex, setActiveRevitIndex] = useState(0);

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    setLoadingBuildings(true);
    fetch(`${apiBaseUrl}/building-list/`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setBuildings(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length) {
          setSelectedBuilding((prev) => prev ?? data[0]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBuildings([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBuildings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const revitTypeRows = useMemo(
    () => revitTypeInput
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter((row) => row),
    [revitTypeInput]
  );
  
  useEffect(() => {
    setActiveRevitIndex((prev) => {
      if (!revitTypeRows.length) return 0;
      if (prev >= revitTypeRows.length) return revitTypeRows.length - 1;
      return prev;
    });
  }, [revitTypeRows.length]);

  const handleMoveActiveRevit = (delta) => {
    if (!revitTypeRows.length) return;
    setActiveRevitIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= revitTypeRows.length) return revitTypeRows.length - 1;
      return next;
    });
  };

  const activeRevitIndexClamped = revitTypeRows.length ? Math.min(activeRevitIndex, revitTypeRows.length - 1) : 0;
  const activeRevitType = revitTypeRows[activeRevitIndexClamped];
  const familyLabel = selectedFamily?.name ?? '패밀리를 선택하세요';
  const familySequence = selectedFamily?.sequence_number ?? '–';
  const buildingLabel = selectedBuilding?.name ?? '건물을 선택하세요';
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 24,
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          flex: '0 0 320px',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          boxShadow: '0 10px 40px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Family List</div>
        <div style={{ flex: 1, minHeight: 400 }}>
          <ProjectFamilyListWidget
            apiBaseUrl={apiBaseUrl}
            selectedFamilyId={selectedFamily?.id}
            onFamilySelect={setSelectedFamily}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 16,
          background: '#fff',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 10px 40px rgba(15,23,42,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 12,
            background: '#fbfbff',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Select Building</div>
          <select
            value={selectedBuilding?.id ?? ''}
            onChange={(event) => {
              const selectedId = Number(event.target.value);
              const match = buildings.find((building) => building.id === selectedId);
              if (match) setSelectedBuilding(match);
            }}
            style={{
              borderRadius: 8,
              border: '1px solid #d1d5db',
              padding: '6px 10px',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value="" disabled>
              {loadingBuildings ? '건물 목록을 불러오는 중입니다...' : '건물을 선택하세요'}
            </option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 16,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 16px rgba(15,23,42,0.05)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Enter Revit Type</div>
          <textarea
            rows={3}
            value={revitTypeInput}
            onChange={(event) => setRevitTypeInput(event.target.value)}
            placeholder="Revit에서 모델링한 타입 이름을 줄 단위로 입력하세요."
            style={{
              borderRadius: 12,
              border: '1px solid #d1d5db',
              padding: 10,
              fontSize: 12,
              minHeight: 96,
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 11, color: '#475467', lineHeight: 1.4 }}>
            좌측 Family List에서 <strong>{familyLabel}</strong>를 선택한 후 &lt;S&gt; 키를 눌러
            장바구니를 동일한 항목으로 일괄 지정하세요. 현재 선택 건물: <strong>{buildingLabel}</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleMoveActiveRevit(1)}
              style={{
                width: 40,
                height: 38,
                borderRadius: 12,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontWeight: 700,
                color: '#0f172a',
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleMoveActiveRevit(-1)}
              style={{
                width: 40,
                height: 38,
                borderRadius: 12,
                border: '1px solid #cbd5f5',
                background: '#fff',
                fontWeight: 700,
                color: '#0f172a',
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              ↑
            </button>
            <span style={{ fontSize: 12, color: '#2563eb' }}>
              {activeRevitType ? `현재 활성 타입: ${activeRevitType}` : '선택된 Revit 타입이 없습니다.'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              fontSize: 11,
              color: '#475467',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontWeight: 600 }}>Revit Type</span>
            <span style={{ fontWeight: 600 }}>Building</span>
            <span style={{ fontWeight: 600 }}>Std</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {revitTypeRows.length ? (
              revitTypeRows.map((type, index) => (
                <div
                  key={`${type}-${index}`}
                  onClick={() => setActiveRevitIndex(index)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr',
                    padding: '6px 8px',
                    borderRadius: 10,
                    background: index === activeRevitIndexClamped ? '#eef2ff' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#0f172a' }}>{type}</span>
                  <span style={{ fontSize: 12 }}>{buildingLabel}</span>
                  <span style={{ fontSize: 12 }}>{familySequence}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>입력된 Revit 타입이 없습니다.</div>
            )}
          </div>
        </div>
        <div
          style={{
            background: '#e0f2fe',
            borderRadius: 12,
            padding: 12,
            color: '#0c4a6e',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Current Building</span>
          <span style={{ fontSize: 12, color: '#2563eb' }}>{selectedBuilding?.name || '건물을 선택하세요'}</span>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            minHeight: 160,
            padding: 12,
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#475467',
            fontSize: 13,
          }}
        >
          좌측에서 건물을 선택하고, 중단의 방향 버튼(↑/↓)으로
          <br />
          순서(순번)를 조정할 수 있습니다.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            style={{
              width: 40,
              height: 38,
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              background: '#fff',
              fontWeight: 700,
              color: '#0f172a',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ↑
          </button>
          <button
            type="button"
            style={{
              width: 40,
              height: 38,
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              background: '#fff',
              fontWeight: 700,
              color: '#0f172a',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ↓
          </button>
          <span style={{ fontSize: 12, color: '#475467' }}>
            윗/아랫 방향 버튼을 눌러 작업 대상 건물 순번을 조정하세요.
          </span>
        </div>
        <button
          type="button"
          style={{
            borderRadius: 12,
            border: 'none',
            padding: '10px 16px',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            width: 'fit-content',
          }}
        >
          Update from common-input
        </button>
        <div style={{ fontSize: 12, color: '#475467' }}>
          Matched WMs for Selected Standard Types
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 12,
            background: '#fff',
            minHeight: 120,
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          자동 매칭 결과가 없습니다.
        </div>
      </div>

      <div
        style={{
          flex: '0 0 360px',
          background: '#fff',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#0f172a',
            fontWeight: 700,
            paddingBottom: 4,
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          Work Master 메뉴
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px 40px', fontSize: 11, color: '#475467' }}>
          {WORK_MASTER_COLUMNS.map((col) => (
            <span key={col} style={{ fontWeight: 600 }}>{col}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {WORK_MASTER_ROWS.map((row) => (
            <div
              key={row.id}
              style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px 40px', padding: '4px 0', borderBottom: '1px solid #e5e7eb' }}
            >
              <span style={{ fontSize: 10 }}>{row.discipline}</span>
              <span style={{ fontSize: 10 }}>{row.item}</span>
              <span style={{ fontSize: 10 }}>{row.detail}</span>
              <span style={{ fontSize: 10 }}>{row.unit}</span>
              <span style={{ fontSize: 10 }}>—</span>
            </div>
          ))}
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px dashed #cbd5f5',
            padding: 10,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          선택된 건물/패밀리 항목에 대응하는 Work Master를
          <br />
          오른쪽 표에 표시합니다.
        </div>
      </div>
    </div>
  );
}

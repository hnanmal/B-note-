import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function ProjectInputMain({ apiBaseUrl }) {
  const [buildings, setBuildings] = useState([]);
  const [buildingName, setBuildingName] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sortedBuildings = useMemo(() => {
    const list = [...buildings];
    return list.sort((a, b) => {
      const aDate = new Date(a?.created_at || 0).getTime();
      const bDate = new Date(b?.created_at || 0).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return (a?.id || 0) - (b?.id || 0);
    });
  }, [buildings]);

  const fetchBuildings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/building-list/`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || '건물 목록을 불러오지 못했습니다.');
      }
      const data = await response.json();
      setBuildings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '건물 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (apiBaseUrl) {
      fetchBuildings();
    }
  }, [apiBaseUrl, fetchBuildings]);

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = (buildingName || '').trim();
    if (!value) {
      setStatusMessage('건물 이름을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/building-list/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || '건물을 추가하지 못했습니다.');
      }
      setBuildingName('');
      setStatusMessage(`'${value}'을(를) 건물 목록에 추가했습니다.`);
      await fetchBuildings();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : '건물을 추가하지 못했습니다.');
    }
  };

  const handleDelete = async () => {
    if (selectedBuildingId === null) {
      setStatusMessage('삭제할 건물을 선택해주세요.');
      return;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/building-list/${selectedBuildingId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || '건물을 삭제하지 못했습니다.');
      }
      setStatusMessage('선택한 건물을 목록에서 제거했습니다.');
      setSelectedBuildingId(null);
      await fetchBuildings();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : '건물을 삭제하지 못했습니다.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>Building List</h2>
        <p style={{ margin: '6px 0 12px 0', color: '#475467' }}>Enter Building Name:</p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={buildingName}
            onChange={(event) => setBuildingName(event.target.value)}
            placeholder="Building Name"
            style={{ flex: '1 1 240px', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5f5', fontSize: 14 }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add Building
          </button>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#dc2626',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete Building
          </button>
        </form>
        {statusMessage && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#334155' }}>{statusMessage}</div>
        )}
        {error && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#b91c1c' }}>{error}</div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            flex: '1 1 auto',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 12,
            background: '#fff',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Building Name</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading ? (
              <div style={{ color: '#475467', fontSize: 12 }}>목록을 불러오는 중입니다...</div>
            ) : !sortedBuildings.length ? (
              <div style={{ color: '#64748b', fontSize: 12 }}>등록된 건물이 없습니다.</div>
            ) : (
              sortedBuildings.map((building) => (
                <div
                  key={building.id}
                  onClick={() => setSelectedBuildingId(building.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedBuildingId(building.id);
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: selectedBuildingId === building.id ? '#e0f2fe' : 'transparent',
                    cursor: 'pointer',
                    border: '1px solid transparent',
                  }}
                >
                  {building.name}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

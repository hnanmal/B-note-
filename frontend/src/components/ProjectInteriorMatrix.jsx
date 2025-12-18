import React, { useEffect, useMemo, useState } from 'react';

const SAMPLE_ROOMS = [
  { name: '101_MESS ROOM', building: 'test_building1', std: '0.1' },
  { name: '102_LOBBY', building: 'test_building1', std: '0.1' },
  { name: '103_FEMALE WASH ROOM LOCKER ROOM', building: 'test_building1', std: '0.1' },
  { name: '104_MALE WASH ROOM LOCKER ROOM', building: 'test_building1', std: '0.1' },
  { name: '105_JANITOR', building: 'test_building1', std: '0.1' },
  { name: '106_TOILET ROOM', building: 'test_building1', std: '0.1' },
  { name: '107_SECURITY & TRUCK LOADING CONTROL ROOM', building: 'test_building1', std: '0.1' },
];

const SAMPLE_SECTIONS = [
  {
    id: 'floor',
    label: 'Floor',
    items: [
      'Hardener::[DQ] Hardener',
      'Paint::[DQ] Anti-Dust Epoxy',
      'Paint::[DQ] Chemical Resistant Epoxy',
      'Paint::[DQ] Epoxy',
      'Paint::[DQ] Epoxy Lining',
      'Paint::[DQ] Epoxy::[DQ]',
      'Raised Floor::[DQ] H800',
      'Tile::[DQ] Acid',
      'Tile::[DQ] Ceramic',
      'Tile::[DQ] Granite',
      'Tile::[DQ] Non-Slip Ceramic::[DQ]',
      'Trowel::[DQ] Steel Trowel',
      'Waterproofing::[DQ] Liquid',
    ],
  },
  {
    id: 'skirt',
    label: 'Skirt',
    items: [
      'Paint::[DQ] Epoxy',
      'Tile::[DQ] Acid',
      'Tile::[DQ] Coved PVC',
      'Tile::[DQ] Unglazed Ceramic',
      'Waterproofing::[DQ] Liquid',
    ],
  },
  {
    id: 'wall',
    label: 'Wall',
    items: [
      'Paint::[DQ] Acrylic Latex',
      'Paint::[DQ] Epoxy',
      'Paint::[DQ] Polymer Cement',
      'Paint::[DQ] Raised Floor_Anti dust Epoxy',
      'Plaster::[DQ] Interior T20',
      'Tile::[DQ] Acid',
      'Tile::[DQ] Glazed Ceramic',
      'Waterproofing::[DQ] Liquid',
    ],
  },
  {
    id: 'ceiling',
    label: 'Ceiling',
    items: [
      'Paint::[DQ] Acrylic Latex',
      'Paint::[DQ] Polymer Cement',
      'Suspended Ceiling::[DQ] Acoustic T-Bar',
      'Suspended Ceiling::[DQ] Moisture M-Bar',
    ],
  },
];

export default function ProjectInteriorMatrix({ apiBaseUrl }) {
  const [rooms, setRooms] = useState(SAMPLE_ROOMS);
  const [interiorSections, setInteriorSections] = useState(SAMPLE_SECTIONS);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectionByBuilding, setSelectionByBuilding] = useState({});

  useEffect(() => {
    if (!apiBaseUrl) return;
    // TODO: wire to project rooms endpoint when available
  }, [apiBaseUrl]);

  const buildingOptions = useMemo(() => {
    const unique = Array.from(new Set(rooms.map((room) => room.building).filter(Boolean)));
    return unique;
  }, [rooms]);

  useEffect(() => {
    if (!selectedBuilding && buildingOptions.length) {
      setSelectedBuilding(buildingOptions[0]);
    }
  }, [buildingOptions, selectedBuilding]);

  const ensureBuildingBucket = (building) => {
    if (!building) return;
    setSelectionByBuilding((prev) => {
      if (prev[building]) return prev;
      return { ...prev, [building]: new Map() };
    });
  };

  useEffect(() => {
    ensureBuildingBucket(selectedBuilding);
  }, [selectedBuilding]);

  const handleToggle = (itemKey, roomName) => {
    if (!selectedBuilding) return;
    setSelectionByBuilding((prev) => {
      const bucket = prev[selectedBuilding] ? new Map(prev[selectedBuilding]) : new Map();
      const roomSet = new Set(bucket.get(itemKey) || []);
      if (roomSet.has(roomName)) {
        roomSet.delete(roomName);
      } else {
        roomSet.add(roomName);
      }
      bucket.set(itemKey, roomSet);
      return { ...prev, [selectedBuilding]: bucket };
    });
  };

  const isChecked = (itemKey, roomName) => {
    const bucket = selectionByBuilding[selectedBuilding];
    if (!bucket) return false;
    const roomSet = bucket.get(itemKey);
    return roomSet ? roomSet.has(roomName) : false;
  };

  const tableHeaders = useMemo(
    () => rooms.filter((room) => !selectedBuilding || room.building === selectedBuilding),
    [rooms, selectedBuilding]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Project Interior Matrix</h2>
        <span style={{ fontSize: 12, color: '#475467' }}>더블 클릭으로 체크/해제</span>
      </div>
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 12,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>Building List</span>
          <select
            value={selectedBuilding || ''}
            onChange={(event) => setSelectedBuilding(event.target.value || null)}
            style={{ border: '1px solid #cbd5f5', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
          >
            {!selectedBuilding && <option value="" disabled>건물을 선택하세요</option>}
            {buildingOptions.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 11, color: '#475467' }}>
          건물별 등록된 Room 기준 · 두 번 클릭하면 체크/해제됩니다.
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          background: '#fff',
          padding: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{
          fontSize: 12,
          color: '#475467',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
        }}>
          <span>인터리어 매트릭스 · Building: {selectedBuilding || '—'}</span>
          <span style={{ color: '#94a3b8' }}>더블 클릭으로 체크</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: '#f8fafc',
                    zIndex: 2,
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: 12,
                    textAlign: 'left',
                    padding: '8px 10px',
                  }}
                >
                  항목
                </th>
                {tableHeaders.map((room) => (
                  <th
                    key={room.name}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: 12,
                      padding: '8px 10px',
                      background: '#f8fafc',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{room.name}</span>
                      <span style={{ fontSize: 11, color: '#475467' }}>{room.building}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Std {room.std}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interiorSections.map((section) => (
                <React.Fragment key={section.id}>
                  <tr>
                    <td
                      colSpan={1 + tableHeaders.length}
                      style={{
                        background: '#ede9fe',
                        color: '#4c1d95',
                        fontWeight: 700,
                        fontSize: 12,
                        padding: '6px 10px',
                      }}
                    >
                      {section.label}
                    </td>
                  </tr>
                  {section.items.map((item) => {
                    const itemKey = `${section.id}::${item}`;
                    return (
                      <tr key={itemKey}>
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            background: '#fff',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: 12,
                            color: '#0f172a',
                            padding: '6px 10px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item}
                        </td>
                        {tableHeaders.map((room) => {
                          const roomKey = room.name;
                          const checked = isChecked(itemKey, roomKey);
                          return (
                            <td
                              key={`${itemKey}-${roomKey}`}
                              onDoubleClick={() => handleToggle(itemKey, roomKey)}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                textAlign: 'center',
                                cursor: 'pointer',
                                userSelect: 'none',
                                padding: '6px 8px',
                                minWidth: 80,
                                color: checked ? '#0f172a' : '#94a3b8',
                              }}
                              title="더블 클릭하여 체크/해제"
                            >
                              {checked ? '☑' : '☐'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

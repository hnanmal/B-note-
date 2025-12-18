import React, { useEffect, useMemo, useState } from 'react';

const INTERIOR_ITEM_STANDARD_MAP = {
  'Suspended Ceiling::[DQ] Acoustic T-Bar': 422,
};

const INTERIOR_ITEM_ASSIGNMENT_MAP = {
  422: 948,
};

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

const normalizeSampleRooms = () => SAMPLE_ROOMS.map((room) => ({
  key: room.name,
  label: room.name,
  building: room.building || '',
  std: room.std || '',
}));

const buildSectionsFromSamples = () => SAMPLE_SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  items: section.items.map((name) => {
    const mapKey = `${section.id}::${name}`;
    return {
      key: mapKey,
      label: name,
      standardItemId: INTERIOR_ITEM_STANDARD_MAP[mapKey] || null,
    };
  }),
}));

const parseRevitRoom = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const parts = raw.split('\t');
  const hasBuilding = parts.length > 1;
  const building = hasBuilding ? (parts.shift() || '').trim() : '';
  const label = (hasBuilding ? parts.join('\t') : raw) || raw;
  return {
    key: raw || label,
    label,
    building,
    std: '',
  };
};

const buildSectionsFromStandardItems = (items, projectAbbr = '') => {
  if (!Array.isArray(items)) return [];
  const swmItems = items.filter((item) => (item?.type || '').toUpperCase() === 'SWM');
  if (!swmItems.length) return [];

  const itemMap = new Map();
  swmItems.forEach((item) => itemMap.set(item.id, item));

  const childrenByParent = new Map();
  swmItems.forEach((item) => {
    if (!item.parent_id) return;
    if (!childrenByParent.has(item.parent_id)) {
      childrenByParent.set(item.parent_id, []);
    }
    childrenByParent.get(item.parent_id).push(item);
  });

  const roomFinishRoots = swmItems.filter(
    (item) => typeof item.name === 'string' && item.name.toLowerCase().includes('room finish')
  );
  const targetRoot = roomFinishRoots.find((item) => !item.parent_id) || roomFinishRoots[0];
  if (!targetRoot) return [];

  const level1 = childrenByParent.get(targetRoot.id) || [];
  const sections = level1
    .map((child) => {
      const grandchildren = childrenByParent.get(child.id) || [];
      const derivedGrand = grandchildren.filter((item) => item.derive_from);
      if (!derivedGrand.length) return null;
      const sortedGrand = [...derivedGrand].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return {
        id: `std-${child.id}`,
        label: child.name,
        items: sortedGrand.map((grand) => ({
          key: `std-${grand.id}`,
          label: (() => {
            const parentName = itemMap.get(grand.derive_from)?.name;
            const abbrPart = projectAbbr ? ` [${projectAbbr}]` : '';
            const childName = (grand.name || '').replace(/\s*\[[^\]]*]\s*$/, '').trim() || grand.name;
            return parentName ? `${parentName}${abbrPart}::${childName}` : grand.name;
          })(),
          standardItemId: grand.id,
        })),
      };
    })
    .filter(Boolean);

  return sections.sort((a, b) => a.label.localeCompare(b.label));
};

export default function ProjectInteriorMatrix({ apiBaseUrl }) {
  const [rooms, setRooms] = useState(normalizeSampleRooms);
  const [buildings, setBuildings] = useState([]);
  const [interiorSections, setInteriorSections] = useState(buildSectionsFromSamples);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectionByBuilding, setSelectionByBuilding] = useState({});
  const [cartEntries, setCartEntries] = useState([]);
  const [projectAbbr, setProjectAbbr] = useState('');
  const [standardItems, setStandardItems] = useState([]);

  useEffect(() => {
    if (!apiBaseUrl || !apiBaseUrl.includes('/project/')) return undefined;
    let cancelled = false;
    fetch(`${apiBaseUrl}/metadata/abbr`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        setProjectAbbr(payload?.pjt_abbr ?? '');
      })
      .catch(() => {
        if (!cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    const loadBuildings = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/building-list/`);
        if (!res.ok) return;
        const payload = await res.json();
        if (cancelled) return;
        setBuildings(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (cancelled) return;
        setBuildings([]);
      }
    };
    loadBuildings();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    const loadCart = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/workmaster-cart`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const normalized = Array.isArray(data) ? data : [];
        setCartEntries(normalized);
        const parsedRooms = [];
        const seen = new Set();
        normalized.forEach((entry) => {
          (entry?.revitTypes || []).forEach((rt) => {
            const room = parseRevitRoom(rt);
            if (!seen.has(room.key)) {
              seen.add(room.key);
              parsedRooms.push(room);
            }
          });
        });
        if (parsedRooms.length) {
          setRooms(parsedRooms);
        }
      } catch (error) {
        // ignore cart fetch errors
      }
    };
    loadCart();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    const loadStandardItems = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/standard-items/`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStandardItems(Array.isArray(data) ? data : []);
        const built = buildSectionsFromStandardItems(data, projectAbbr);
        if (built.length) {
          setInteriorSections(built);
        }
      } catch (error) {
        // fall back to samples on failure
        if (!cancelled) setInteriorSections(buildSectionsFromSamples());
      }
    };
    loadStandardItems();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, projectAbbr]);

  useEffect(() => {
    if (!standardItems.length) return;
    const built = buildSectionsFromStandardItems(standardItems, projectAbbr);
    if (built.length) {
      setInteriorSections(built);
    }
  }, [standardItems, projectAbbr]);

  const buildingOptions = useMemo(() => {
    const set = new Set();
    buildings.forEach((b) => {
      if (b?.name) set.add(b.name);
    });
    rooms.forEach((room) => {
      if (room?.building) set.add(room.building);
    });
    return Array.from(set);
  }, [buildings, rooms]);

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

  const entryAssignmentIds = (standardItemId) => {
    const assignmentId = INTERIOR_ITEM_ASSIGNMENT_MAP[standardItemId];
    return assignmentId ? [assignmentId] : [];
  };

  const handleToggle = (itemKey, standardItemId, roomKey) => {
    if (!selectedBuilding) return;
    if (!standardItemId) return;

    const existing = cartEntries.find(
      (entry) => Array.isArray(entry?.revitTypes) && entry.revitTypes.includes(roomKey)
        && Array.isArray(entry?.standardItemIds) && entry.standardItemIds.includes(standardItemId)
    );

    const saveEntry = async () => {
      const payload = {
        revitTypes: [roomKey],
        assignmentIds: entryAssignmentIds(standardItemId),
        standardItemIds: [standardItemId],
        formula: '=A',
      };
      await fetch(`${apiBaseUrl}/workmaster-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
    };

    const deleteEntry = async (entryId) => {
      await fetch(`${apiBaseUrl}/workmaster-cart/${entryId}`, { method: 'DELETE' }).catch(() => null);
    };

    if (existing?.id) {
      deleteEntry(existing.id).then(() => {
        setCartEntries((prev) => prev.filter((e) => e.id !== existing.id));
      });
    } else {
      saveEntry().then(() => {
        setCartEntries((prev) => [
          ...prev,
          {
            id: Date.now(),
            revitTypes: [roomKey],
            assignmentIds: entryAssignmentIds(standardItemId),
            standardItemIds: [standardItemId],
            formula: '=A',
          },
        ]);
      });
    }

    setSelectionByBuilding((prev) => {
      const bucket = prev[selectedBuilding] ? new Map(prev[selectedBuilding]) : new Map();
      const roomSet = new Set(bucket.get(itemKey) || []);
      if (roomSet.has(roomKey)) {
        roomSet.delete(roomKey);
      } else {
        roomSet.add(roomKey);
      }
      bucket.set(itemKey, roomSet);
      return { ...prev, [selectedBuilding]: bucket };
    });
  };

  const isChecked = (itemKey, standardItemId, roomKey) => {
    if (!standardItemId) return false;
    const hasCart = cartEntries.some(
      (entry) => Array.isArray(entry?.revitTypes) && entry.revitTypes.includes(roomKey)
        && Array.isArray(entry?.standardItemIds) && entry.standardItemIds.includes(standardItemId)
    );
    if (hasCart) return true;

    const bucket = selectionByBuilding[selectedBuilding];
    if (!bucket) return false;
    const roomSet = bucket.get(itemKey);
    return roomSet ? roomSet.has(roomKey) : false;
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
                    key={room.key}
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
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{room.label}</span>
                      <span style={{ fontSize: 11, color: '#475467' }}>{room.building}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{room.std ? `Std ${room.std}` : ''}</span>
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
                    const itemKey = item.key;
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
                          {item.label}
                        </td>
                        {tableHeaders.map((room) => {
                          const roomKey = room.key;
                          const checked = isChecked(itemKey, item.standardItemId, roomKey);
                          return (
                            <td
                              key={`${itemKey}-${roomKey}`}
                              onDoubleClick={() => handleToggle(itemKey, item.standardItemId, roomKey)}
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

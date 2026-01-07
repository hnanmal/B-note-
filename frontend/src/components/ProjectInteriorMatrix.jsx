import React, { useEffect, useMemo, useState } from 'react';

const INTERIOR_ITEM_STANDARD_MAP = {
  'Suspended Ceiling::[DQ] Acoustic T-Bar': 422,
};

const INTERIOR_ITEM_ASSIGNMENT_MAP = {
  422: 948,
};

const SECTION_ORDER = {
  floor: 0,
  skirt: 1,
  wall: 2,
  base: 3,
};

const sortSectionsByPriority = (sections = []) => {
  const getOrder = (label = '') => {
    const key = label.trim().toLowerCase();
    const match = Object.entries(SECTION_ORDER).find(([name]) => key.startsWith(name));
    return match ? match[1] : Number.MAX_SAFE_INTEGER;
  };
  return [...sections].sort((a, b) => {
    const ao = getOrder(a.label);
    const bo = getOrder(b.label);
    if (ao !== bo) return ao - bo;
    return (a.label || '').localeCompare(b.label || '');
  });
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

const parseRevitRoom = (value, knownBuildings = []) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return { key: '', label: '', building: '', std: '' };
  }

  const parts = raw.split('\t');
  const first = (parts[0] || '').trim();
  const rest = parts.slice(1).join('\t').trim();
  const normalizedKnown = knownBuildings.map((b) => (b || '').trim().toLowerCase());
  const looksLikeBuilding =
    parts.length > 1
    && first
    && (normalizedKnown.includes(first.toLowerCase()) || first.toLowerCase().includes('building'));
  const building = looksLikeBuilding ? first : '';
  const label = building ? (rest || raw) : raw.replace(/\t+/g, ' ');
  const stdMatch = label.match(/^(\d+(?:\.\d+)?)/);
  const std = stdMatch ? stdMatch[1] : '';
  return {
    key: raw,
    label,
    building,
    std,
  };
};

const normalizeRoomKey = (value) =>
  (value || '')
    .replace(/\t+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();

const deriveBuildingNames = (entry, knownBuildings = []) => {
  const explicit = Array.isArray(entry?.buildingNames ?? entry?.building_names)
    ? (entry.buildingNames ?? entry.building_names)
    : [];
  const cleaned = explicit.map((b) => (b || '').trim()).filter(Boolean);
  if (cleaned.length) return Array.from(new Set(cleaned));

  const inferred = (entry?.revitTypes ?? entry?.revit_types ?? [])
    .map((rt) => parseRevitRoom(rt, knownBuildings).building)
    .filter(Boolean);
  return Array.from(new Set(inferred));
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
      const enriched = derivedGrand.map((grand) => {
        const parentName = itemMap.get(grand.derive_from)?.name;
        const childName = (grand.name || '').replace(/\s*\[[^\]]*]\s*$/, '').trim() || grand.name;
        const label = parentName ? `${parentName}::${childName}` : grand.name;
        return {
          key: `std-${grand.id}`,
          label,
          standardItemId: grand.id,
        };
      });
      const sortedGrand = enriched.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      return {
        id: `std-${child.id}`,
        label: child.name,
        items: sortedGrand,
      };
    })
    .filter(Boolean);

  return sortSectionsByPriority(sections);
};

const buildSectionsFromCart = (cartEntries, standardItems, projectAbbr = '') => {
  if (!Array.isArray(cartEntries) || !Array.isArray(standardItems)) return [];
  const itemMap = new Map();
  standardItems.forEach((item) => {
    if (item?.id != null) itemMap.set(item.id, item);
  });

  const collected = [];
  cartEntries.forEach((entry) => {
    (entry?.standardItemIds || []).forEach((id) => {
      const item = itemMap.get(id);
      if (!item) return;
      if ((item.type || '').toUpperCase() !== 'SWM') return;
      // Allow non-derived items so cart rows always render when present in DB
      collected.push(item);
    });
  });
  if (!collected.length) return [];

  const grouped = new Map();
  collected.forEach((item) => {
    const parentId = item.parent_id || 'uncategorized';
    if (!grouped.has(parentId)) grouped.set(parentId, []);
    grouped.get(parentId).push(item);
  });

  const sections = [];
  grouped.forEach((itemsForParent, parentId) => {
    const parentName = parentId === 'uncategorized' ? 'Cart Items' : itemMap.get(parentId)?.name;
    const enriched = itemsForParent.map((child) => {
      const deriveParent = child.derive_from ? itemMap.get(child.derive_from)?.name : null;
      const childName = (child.name || '').replace(/\s*\[[^\]]*]\s*$/, '').trim() || child.name;
      const label = deriveParent ? `${deriveParent}::${childName}` : child.name;
      return { key: `std-${child.id}`, label, standardItemId: child.id };
    });
    const sorted = enriched.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    sections.push({
      id: `cart-${parentId}`,
      label: parentName || 'Cart Items',
      items: sorted,
    });
  });

  return sortSectionsByPriority(sections);
};

const normalizeCartEntry = (entry) => ({
  id: entry?.id,
  revitTypes: entry?.revitTypes ?? entry?.revit_types ?? [],
  assignmentIds: entry?.assignmentIds ?? entry?.assignment_ids ?? [],
  standardItemIds: entry?.standardItemIds ?? entry?.standard_item_ids ?? [],
  buildingNames: entry?.buildingNames ?? entry?.building_names ?? [],
  formula: entry?.formula ?? null,
  createdAt: entry?.createdAt ?? entry?.created_at ?? null,
});

const indexAssignmentsByStandardItem = (assignments) => {
  const map = new Map();
  assignments.forEach((assignment) => {
    const stdId = assignment?.standard_item?.id;
    if (stdId != null && assignment?.id != null && !map.has(stdId)) {
      map.set(stdId, assignment.id);
    }
  });
  return map;
};

const mergeCartExtrasIntoSections = (baseSections, cartEntries, standardItems, projectAbbr = '') => {
  const existingIds = new Set();
  baseSections.forEach((section) => {
    section.items.forEach((item) => {
      if (item?.standardItemId != null) existingIds.add(item.standardItemId);
    });
  });

  const itemMap = new Map();
  standardItems.forEach((item) => {
    if (item?.id != null) itemMap.set(item.id, item);
  });

  const extras = [];
  cartEntries.forEach((entry) => {
    (entry?.standardItemIds || []).forEach((id) => {
      if (existingIds.has(id)) return;
      const item = itemMap.get(id);
      if (!item) return;
      if ((item.type || '').toUpperCase() !== 'SWM') return;
      const deriveParent = item.derive_from ? itemMap.get(item.derive_from)?.name : null;
      const childName = (item.name || '').replace(/\s*\[[^\]]*]\s*$/, '').trim() || item.name;
      const label = deriveParent ? `${deriveParent}::${childName}` : item.name;
      extras.push({ key: `cart-${id}`, label, standardItemId: id });
    });
  });

  if (!extras.length) return sortSectionsByPriority(baseSections);
  const extraSection = {
    id: 'cart-extra',
    label: 'Cart Items',
    items: extras.sort((a, b) => (a.label || '').localeCompare(b.label || '')),
  };
  return sortSectionsByPriority([...baseSections, extraSection]);
};

export default function ProjectInteriorMatrix({ apiBaseUrl }) {
  const [rooms, setRooms] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [interiorSections, setInteriorSections] = useState(buildSectionsFromSamples);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedRoomKey, setSelectedRoomKey] = useState(null);
  const [copyTargetRoomKey, setCopyTargetRoomKey] = useState(null);
  const [selectionByBuilding, setSelectionByBuilding] = useState({});
  const [cartEntries, setCartEntries] = useState([]);
  const [hasLoadedCartOnce, setHasLoadedCartOnce] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [projectAbbr, setProjectAbbr] = useState('');
  const [standardItems, setStandardItems] = useState([]);
  const [isStandardItemsLoading, setIsStandardItemsLoading] = useState(false);
  const [roomFamilyId, setRoomFamilyId] = useState(null);
  const [familyAssignments, setFamilyAssignments] = useState([]);
  const assignmentIndex = useMemo(() => indexAssignmentsByStandardItem(familyAssignments), [familyAssignments]);

  const buildingOptions = useMemo(() => {
    const sorted = [...buildings].sort((a, b) => {
      const aDate = new Date(a?.created_at || 0).getTime();
      const bDate = new Date(b?.created_at || 0).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return (a?.id || 0) - (b?.id || 0);
    });
    const result = [];
    const seen = new Set();
    sorted.forEach((b) => {
      if (!b?.name) return;
      if (seen.has(b.name)) return;
      seen.add(b.name);
      result.push(b.name);
    });
    return result;
  }, [buildings]);

  const reloadCartEntries = async ({ showOverlay = false } = {}) => {
    if (!apiBaseUrl) return;
    try {
      if (showOverlay) setIsCartLoading(true);
      const res = await fetch(`${apiBaseUrl}/workmaster-cart`);
      if (!res.ok) return;
      const data = await res.json();
      const normalized = Array.isArray(data) ? data.map(normalizeCartEntry) : [];
      setCartEntries(normalized);
      const parsedRooms = [];
      const seen = new Set();
      normalized.forEach((entry) => {
        const buildingsForEntry = deriveBuildingNames(entry, buildingOptions);
        (entry?.revitTypes || []).forEach((rt, idx) => {
          const room = parseRevitRoom(rt, buildingOptions);
          const buildingName = buildingsForEntry[idx] || buildingsForEntry[0] || room.building || '';
          if (buildingName) room.building = buildingName;
          const dedupKey = buildingName ? `${room.key}__${buildingName}` : room.key;
          if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            parsedRooms.push(room);
          }
        });
      });
      if (parsedRooms.length) {
        setRooms((prev) => (prev.length ? prev : parsedRooms));
      }
    } catch (error) {
      // ignore fetch errors
    } finally {
      if (showOverlay) {
        setIsCartLoading(false);
        setHasLoadedCartOnce(true);
      }
    }
  };

  useEffect(() => {
    if (rooms.length) return;
    const parsedRooms = [];
    const seen = new Set();
    cartEntries.forEach((entry) => {
      const buildingsForEntry = deriveBuildingNames(entry, buildingOptions);
      (entry?.revitTypes || []).forEach((rt, idx) => {
        const room = parseRevitRoom(rt, buildingOptions);
        const buildingName = buildingsForEntry[idx] || buildingsForEntry[0] || room.building || '';
        if (buildingName) room.building = buildingName;
        const dedupKey = buildingName ? `${room.key}__${buildingName}` : room.key;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          parsedRooms.push(room);
        }
      });
    });
    if (parsedRooms.length) {
      setRooms((prev) => (prev.length ? prev : parsedRooms));
    }
  }, [cartEntries, rooms.length, buildingOptions]);

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
  }, [apiBaseUrl, buildingOptions]);

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
    if (!apiBaseUrl || !apiBaseUrl.includes('/project/')) return undefined;
    let cancelled = false;
    const loadRoomsFromFamily = async () => {
      try {
        // Load all family list items, collect every revit type as room header
        const listRes = await fetch(`${apiBaseUrl}/family-list/`);
        if (!listRes.ok) return;
        const listData = await listRes.json();
        if (cancelled) return;
        const items = Array.isArray(listData) ? listData : [];
        const roomFamilies = items.filter((item) => typeof item?.name === 'string'
          && item.name.trim().toLowerCase() === 'rooms');
        if (!roomFamilies.length) return;
        setRoomFamilyId((prev) => prev ?? roomFamilies[0]?.id ?? null);
        const allRooms = [];
        const revitPayloads = await Promise.allSettled(
          roomFamilies
            .filter((item) => item?.id)
            .map(async (item) => {
              const res = await fetch(`${apiBaseUrl}/family-list/${item.id}/revit-types`);
              if (!res.ok) return [];
              const data = await res.json();
              return Array.isArray(data) ? data : [];
            })
        );
        revitPayloads.forEach((result) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            result.value.forEach((rt) => {
              const room = parseRevitRoom(rt?.type_name || '', buildingOptions);
              const buildingName = (rt?.building_name || '').trim();
              const dedupKey = buildingName ? `${room.key}__${buildingName}` : room.key;
              if (buildingName) {
                room.building = buildingName;
              }
              if (room.key) allRooms.push({ ...room, dedupKey });
            });
          }
        });
        if (allRooms.length) {
          const unique = [];
          const seen = new Set();
          allRooms.forEach((r) => {
            const key = r.dedupKey || r.key;
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(r);
          });
          setRooms(unique);
        }
      } catch (error) {
        // ignore; fallback to cart-derived rooms
      }
    };
    loadRoomsFromFamily();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    setHasLoadedCartOnce(false);
    setIsCartLoading(true);
    reloadCartEntries({ showOverlay: true }).catch(() => {
      if (!cancelled) {
        setIsCartLoading(false);
        setHasLoadedCartOnce(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl || !roomFamilyId) return undefined;
    let cancelled = false;
    const loadAssignments = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/family-list/${roomFamilyId}/assignments`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setFamilyAssignments(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        setFamilyAssignments([]);
      }
    };
    loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, roomFamilyId]);

  useEffect(() => {
    if (!apiBaseUrl) return undefined;
    let cancelled = false;
    const loadStandardItems = async () => {
      try {
        setIsStandardItemsLoading(true);
        const res = await fetch(`${apiBaseUrl}/standard-items/`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStandardItems(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) setStandardItems([]);
      } finally {
        if (!cancelled) setIsStandardItemsLoading(false);
      }
    };
    loadStandardItems();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const roomMetaByKey = useMemo(() => {
    const map = new Map();
    rooms.forEach((room) => {
      if (!room?.key) return;
      map.set(room.key, {
        norm: normalizeRoomKey(room.label || room.key),
        building: (room.building || '').trim(),
      });
    });
    return map;
  }, [rooms]);

  const cartIndex = useMemo(() => {
    const index = new Map();
    cartEntries.forEach((entry) => {
      const standardItemIds = Array.isArray(entry?.standardItemIds) ? entry.standardItemIds : [];
      if (!standardItemIds.length) return;

      const revits = Array.isArray(entry?.revitTypes) ? entry.revitTypes : [];
      if (!revits.length) return;

      const buildingsForEntry = deriveBuildingNames(entry, buildingOptions);
      const hasWildcardBuilding = !buildingsForEntry.length;

      revits.forEach((rt) => {
        const parsed = parseRevitRoom(rt, buildingOptions);
        const norm = normalizeRoomKey(parsed.label || rt);
        if (!norm) return;
        standardItemIds.forEach((sid) => {
          if (sid == null) return;
          if (!index.has(sid)) index.set(sid, new Map());
          const byRoom = index.get(sid);
          const record = byRoom.get(norm) || { hasWildcardBuilding: false, buildings: new Set() };
          if (hasWildcardBuilding) record.hasWildcardBuilding = true;
          buildingsForEntry.forEach((b) => record.buildings.add(b));
          byRoom.set(norm, record);
        });
      });
    });
    return index;
  }, [cartEntries, buildingOptions]);

  const isInitialDbSyncing = (!hasLoadedCartOnce && isCartLoading) || isStandardItemsLoading;

  useEffect(() => {
    const derivedSections = buildSectionsFromStandardItems(standardItems, projectAbbr);
    if (derivedSections.length) {
      const merged = mergeCartExtrasIntoSections(derivedSections, cartEntries, standardItems, projectAbbr);
      setInteriorSections(merged);
      return;
    }
    const cartSections = buildSectionsFromCart(cartEntries, standardItems, projectAbbr);
    if (cartSections.length) {
      setInteriorSections(cartSections);
      return;
    }
    if (!standardItems.length) {
      setInteriorSections(buildSectionsFromSamples());
    } else {
      setInteriorSections([]);
    }
  }, [standardItems, projectAbbr, cartEntries]);

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
    const mapAssignment = INTERIOR_ITEM_ASSIGNMENT_MAP[standardItemId];
    if (mapAssignment) return [mapAssignment];
    if (assignmentIndex.has(standardItemId)) return [assignmentIndex.get(standardItemId)];
    const fromCart = cartEntries.find(
      (entry) => Array.isArray(entry?.standardItemIds) && entry.standardItemIds.includes(standardItemId)
        && Array.isArray(entry?.assignmentIds) && entry.assignmentIds.length
    );
    if (fromCart) return [...fromCart.assignmentIds];
    return [];
  };

  const handleToggle = (itemKey, standardItemId, roomKey) => {
    if (isInitialDbSyncing) return;
    if (!selectedBuilding) return;
    if (!standardItemId) return;

    const parsedTarget = parseRevitRoom(roomKey, buildingOptions);
    const targetNorm = normalizeRoomKey(parsedTarget.label || roomKey);
    const targetBuilding = selectedBuilding || parsedTarget.building || '';
    setSelectedRoomKey(roomKey);

    const matchEntry = (entry, { requireBuilding = true } = {}) => {
      const matchesStd = Array.isArray(entry?.standardItemIds) && entry.standardItemIds.includes(standardItemId);
      if (!matchesStd) return false;
      const revits = Array.isArray(entry?.revitTypes) ? entry.revitTypes : [];
      const buildings = deriveBuildingNames(entry, buildingOptions);
      const matchesBuilding = !requireBuilding
        || !targetBuilding
        || !buildings.length
        || buildings.includes(targetBuilding);
      if (!matchesBuilding) return false;
      return revits.some((rt) => {
        const parsed = parseRevitRoom(rt, buildingOptions);
        const norm = normalizeRoomKey(parsed.label || rt);
        return norm === targetNorm;
      });
    };

    const existing =
      cartEntries.find((entry) => matchEntry(entry, { requireBuilding: true }))
      || cartEntries.find((entry) => matchEntry(entry, { requireBuilding: false }));

    const saveEntry = async () => {
      const buildingName = targetBuilding;
      let baseRoom = parsedTarget.label || roomKey;
      if (buildingName && roomKey.startsWith(`${buildingName}\t`)) {
        baseRoom = roomKey.slice(buildingName.length + 1).trim();
      }
      const payload = {
        revit_types: [baseRoom],
        building_names: buildingName ? [buildingName] : [],
        assignment_ids: entryAssignmentIds(standardItemId),
        standard_item_ids: [standardItemId],
        formula: '=A',
      };
      await fetch(`${apiBaseUrl}/workmaster-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
      await reloadCartEntries({ showOverlay: false });
    };

    const deleteEntry = async (entryId) => {
      await fetch(`${apiBaseUrl}/workmaster-cart/${entryId}`, { method: 'DELETE' }).catch(() => null);
      await reloadCartEntries({ showOverlay: false });
    };

    if (existing?.id) {
      // Optimistic removal for immediate UI update
      setCartEntries((prev) => prev.filter((entry) => entry.id !== existing.id));
      deleteEntry(existing.id).catch(() => {});
    } else {
      saveEntry().catch(() => {});
    }

    setSelectionByBuilding((prev) => {
      const bucket = prev[selectedBuilding] ? new Map(prev[selectedBuilding]) : new Map();
      const roomSet = new Set(bucket.get(itemKey) || []);
      if (existing?.id) {
        roomSet.delete(roomKey);
      } else {
        roomSet.add(roomKey);
      }
      if (roomSet.size) {
        bucket.set(itemKey, roomSet);
      } else {
        bucket.delete(itemKey);
      }
      return { ...prev, [selectedBuilding]: bucket };
    });
  };

  const isChecked = (itemKey, standardItemId, roomKey) => {
    if (!standardItemId) return false;
    const meta = roomMetaByKey.get(roomKey);
    const targetNorm = meta?.norm || normalizeRoomKey(parseRevitRoom(roomKey, buildingOptions).label || roomKey);
    const targetBuilding = selectedBuilding || meta?.building || '';
    const byRoom = cartIndex.get(standardItemId);
    const record = byRoom?.get(targetNorm);
    if (record && (!targetBuilding || record.hasWildcardBuilding || record.buildings.has(targetBuilding))) {
      return true;
    }

    const bucket = selectionByBuilding[selectedBuilding];
    if (!bucket) return false;
    const roomSet = bucket.get(itemKey);
    return roomSet ? roomSet.has(roomKey) : false;
  };

  const tableHeaders = useMemo(
    () => rooms.filter((room) => {
      const matchesBuilding = !selectedBuilding
        || !room.building
        || room.building === selectedBuilding;
      return matchesBuilding;
    }),
    [rooms, selectedBuilding]
  );

  const handleCopySelectionToRoom = () => {
    if (isInitialDbSyncing) return;
    if (!selectedRoomKey || !copyTargetRoomKey) return;
    if (selectedRoomKey === copyTargetRoomKey) return;

    interiorSections.forEach((section) => {
      section.items.forEach((item) => {
        const itemKey = item.key;
        const stdId = item.standardItemId;
        const sourceChecked = isChecked(itemKey, stdId, selectedRoomKey);
        const targetChecked = isChecked(itemKey, stdId, copyTargetRoomKey);
        if (sourceChecked !== targetChecked) {
          handleToggle(itemKey, stdId, copyTargetRoomKey);
        }
      });
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Project Interior Matrix</h2>
        <span style={{ fontSize: 12, color: '#475467' }}>클릭으로 체크/해제</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>· 선택 룸 → 다른 룸 복사 지원</span>
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
          건물별 등록된 Room 기준 · 클릭하면 체크/해제됩니다.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>룸 복사</span>
          <select
            value={selectedRoomKey || ''}
            onChange={(event) => setSelectedRoomKey(event.target.value || null)}
            style={{ border: '1px solid #cbd5f5', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
          >
            <option value="" disabled>
              원본 룸 선택
            </option>
            {tableHeaders.map((room) => (
              <option key={`${room.key}-src`} value={room.key}>
                {room.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: '#475467' }}>→</span>
          <select
            value={copyTargetRoomKey || ''}
            onChange={(event) => setCopyTargetRoomKey(event.target.value || null)}
            style={{ border: '1px solid #cbd5f5', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
          >
            <option value="" disabled>
              대상 룸 선택
            </option>
            {tableHeaders
              .filter((room) => room.key !== selectedRoomKey)
              .map((room) => (
                <option key={`${room.key}-dest`} value={room.key}>
                  {room.label}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={handleCopySelectionToRoom}
            disabled={isInitialDbSyncing || !selectedRoomKey || !copyTargetRoomKey || selectedRoomKey === copyTargetRoomKey}
            style={{
              border: '1px solid #2563eb',
              background: isInitialDbSyncing || !selectedRoomKey || !copyTargetRoomKey || selectedRoomKey === copyTargetRoomKey
                ? '#e5e7eb'
                : '#2563eb',
              color: isInitialDbSyncing || !selectedRoomKey || !copyTargetRoomKey || selectedRoomKey === copyTargetRoomKey
                ? '#94a3b8'
                : '#fff',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: isInitialDbSyncing || !selectedRoomKey || !copyTargetRoomKey || selectedRoomKey === copyTargetRoomKey
                ? 'not-allowed'
                : 'pointer',
            }}
            title="선택한 원본 룸의 체크 상태를 대상 룸에 그대로 복사합니다"
          >
            체크 복사
          </button>
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
          <span style={{ color: '#94a3b8' }}>클릭으로 체크</span>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            position: 'relative',
          }}
        >
          {isInitialDbSyncing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255, 255, 255, 0.78)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  체크 상태 불러오는 중…
                </div>
                <div style={{ fontSize: 12, color: '#475467', marginTop: 6 }}>
                  DB 상태를 반영하는 동안 잠시만 기다려주세요.
                </div>
              </div>
            </div>
          )}
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
                {tableHeaders.map((room) => {
                  const isSelected = selectedRoomKey === room.key;
                  return (
                    <th
                      key={`${room.key}__${room.building || 'global'}`}
                      onClick={() => setSelectedRoomKey(room.key)}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        fontSize: 12,
                        padding: '8px 10px',
                        background: '#f8fafc',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: isSelected ? '#2563eb' : '#0f172a' }}>
                          {room.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#475467', fontWeight: isSelected ? 700 : 400 }}>
                          {room.building}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{room.std ? `Std ${room.std}` : ''}</span>
                      </div>
                    </th>
                  );
                })}
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
                              onClick={() => handleToggle(itemKey, item.standardItemId, roomKey)}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                textAlign: 'center',
                                cursor: isInitialDbSyncing ? 'not-allowed' : 'pointer',
                                userSelect: 'none',
                                padding: '6px 8px',
                                minWidth: 80,
                                color: checked ? '#0f172a' : '#94a3b8',
                                opacity: isInitialDbSyncing ? 0.6 : 1,
                              }}
                              title="클릭하여 체크/해제"
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

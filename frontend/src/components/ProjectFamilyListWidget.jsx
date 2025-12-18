import React, { useEffect, useMemo, useState } from 'react';

const buildTree = (items) => {
  const map = new Map();
  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });
  const roots = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodesToSort) => {
    nodesToSort.sort((a, b) => {
      const seqA = a.sequence_number ?? a.name ?? '';
      const seqB = b.sequence_number ?? b.name ?? '';
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });
    nodesToSort.forEach((child) => {
      if (child.children.length) sortNodes(child.children);
    });
  };
  sortNodes(roots);
  return roots;
};

const flattenTree = (nodes, level = 0, accumulator = []) => {
  nodes.forEach((node) => {
    accumulator.push({ ...node, level });
    if (node.children.length) {
      flattenTree(node.children, level + 1, accumulator);
    }
  });
  return accumulator;
};

export default function ProjectFamilyListWidget({ apiBaseUrl, selectedFamilyId, selectedBuildingName = '', onFamilySelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const listContainerRef = React.useRef(null);

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/family-list/`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Family list를 불러오지 못했습니다.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : '알 수 없는 오류가 발생했습니다.');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const text = `${item.sequence_number ?? ''} ${item.name ?? ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [items, searchTerm]);

  const tree = useMemo(() => buildTree(filteredItems), [filteredItems]);
  const flattened = useMemo(() => flattenTree(tree), [tree]);
  const selectedIndex = useMemo(
    () => flattened.findIndex((node) => node.id === selectedFamilyId),
    [flattened, selectedFamilyId]
  );

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        boxSizing: 'border-box',
        height: '100%',
        background: '#fff',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Family List</strong>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{loading ? '로딩 중...' : `${items.length} items`}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#475467' }}>
        프로젝트에 등록된 Family 항목을 계층적으로 보여줍니다.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Sequence / Name"
          style={{
            flex: 1,
            border: '1px solid #d1d5db',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
          }}
        />
        <button
          type="button"
          onClick={() => setSearchTerm('')}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 8,
            background: '#f8fafc',
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
      <div
        ref={listContainerRef}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!flattened.length || !onFamilySelect) return;
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          const currentIndex = selectedIndex === -1 ? (direction === 1 ? -1 : 0) : selectedIndex;
          const nextIndex = Math.max(0, Math.min(flattened.length - 1, currentIndex + direction));
          const nextNode = flattened[nextIndex];
          if (nextNode) onFamilySelect(nextNode);
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 16px 12px 12px',
          scrollbarGutter: 'stable both-edges',
          paddingRight: 18,
          background: '#f8fafc',
        }}
      >
        {error && (
          <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>
        )}
        {!error && !flattened.length && (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Family 항목이 없습니다.</div>
        )}
        {!error && flattened.map((node) => {
          const hasRevitForBuilding = Array.isArray(node.revit_types)
            ? node.revit_types.some((rt) => {
                const b = (rt?.building_name || '').trim();
                const target = (selectedBuildingName || '').trim();
                if (!target) return !!rt?.type_name; // no building selected: any revit type
                return b === target;
              })
            : false;
          return (
          <div
            key={`${node.id}-${node.level}`}
            onClick={() => onFamilySelect?.(node)}
            style={{
              padding: '4px 0',
              paddingLeft: `${8 + node.level * 12}px`,
              fontSize: 11,
              color: '#0f172a',
              borderBottom: '1px solid rgba(15,23,42,0.08)',
              background:
                node.id === selectedFamilyId
                  ? '#e0f2fe'
                  : hasRevitForBuilding
                    ? '#f3e8ff'
                    : 'transparent',
              cursor: onFamilySelect ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: node.sequence_number ? 'space-between' : 'flex-start',
                gap: 8,
              }}
            >
              {node.sequence_number && <span>{node.sequence_number}</span>}
              <strong style={{ fontWeight: 600 }}>{node.name || 'Unnamed'}</strong>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
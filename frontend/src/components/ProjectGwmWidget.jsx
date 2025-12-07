import React, { useEffect, useMemo, useState } from 'react';

const buildTree = (items) => {
  const map = new Map();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodesToSort) => {
    nodesToSort.sort((a, b) => a.name.localeCompare(b.name));
    nodesToSort.forEach((child) => {
      if (child.children.length) {
        sortNodes(child.children);
      }
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

export default function ProjectGwmWidget({ apiBaseUrl }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/standard-items/`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('GWM 데이터를 불러오지 못했습니다.');
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
    return items.filter((item) => (item.name || '').toLowerCase().includes(term));
  }, [items, searchTerm]);

  const tree = useMemo(() => buildTree(filteredItems), [filteredItems]);
  const flattened = useMemo(() => flattenTree(tree), [tree]);

  return (
    <div
      style={{
        flex: '0 0 320px',
        background: '#fff',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Project GWM Widget</strong>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{loading ? '로딩 중...' : `${items.length} items`}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#475467' }}>
        선택한 프로젝트의 GWM 트리를 빠르게 탐색합니다.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="검색" 
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
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 12,
          background: '#f8fafc',
        }}
      >
        {error && (
          <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>
        )}
        {!error && !flattened.length && (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>표준 GWM 항목이 없습니다.</div>
        )}
        {!error && flattened.map((node) => (
          <div
            key={node.id}
            style={{
              padding: '4px 0',
              paddingLeft: `${8 + node.level * 12}px`,
              fontSize: 11,
              color: '#0f172a',
              borderBottom: '1px solid rgba(15,23,42,0.08)',
            }}
          >
            {node.name || 'Unnamed'}
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { API_BASE_URL } from '../apiConfig';

const setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;
    for (const value of a) {
        if (!b.has(value)) return false;
    }
    return true;
};

export default function StandardTreeManager({
    onNodeSelect,
    refreshSignal,
    level2CheckboxesEnabled = false,
    checkboxDepth = 2,
    onCheckboxSelectionChange,
    externalCheckboxSelection = [],
    apiBaseUrl = API_BASE_URL,
    onItemsChange = () => {},
    externalSelectedId = null,
}) {
    const [items, setItems] = useState([]);
    const [tree, setTree] = useState([]);
    const [selected, setSelected] = useState(null);
    const [addingForParent, setAddingForParent] = useState(undefined); // undefined = not adding, null = root, id = child
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('GWM');
    const inputRef = useRef(null);
    const [filterType, setFilterType] = useState('ALL'); // ALL | GWM | SWM
    const [message, setMessage] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [matchIds, setMatchIds] = useState([]);
    const [matchIndex, setMatchIndex] = useState(-1);
    const treeContainerRef = useRef(null);
    const nodeRefs = useRef(new Map());
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [viewLevel, setViewLevel] = useState(3);
    const [checkboxSelection, setCheckboxSelection] = useState(() => new Set());
    const [projectAbbr, setProjectAbbr] = useState('');
    const isProjectContext = apiBaseUrl.includes('/project/');

    const scrollMatchIntoView = (matchId) => {
        const target = nodeRefs.current.get(matchId);
        if (target && target.scrollIntoView) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        if (treeContainerRef.current) {
            treeContainerRef.current.scrollTop = 0;
        }
    };

    const fetchAll = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/standard-items/`);
            if (!res.ok) throw new Error('표준 항목 조회 실패');
            const data = await res.json();
            setItems(data);
            onItemsChange(Array.isArray(data) ? data : []);
        } catch (e) {
            setMessage(e.message);
        }
    };

    useEffect(() => { fetchAll(); }, [refreshSignal]);

    useEffect(() => {
        if (!apiBaseUrl.includes('/project/')) {
            setProjectAbbr('');
            return undefined;
        }
        let cancelled = false;
        fetch(`${apiBaseUrl}/metadata/abbr`)
            .then((res) =>
                res.ok ? res.json() : Promise.reject(new Error('약호 조회 실패'))
            )
            .then((payload) => {
                if (cancelled) return;
                setProjectAbbr(payload?.pjt_abbr ?? '');
            })
            .catch(() => {
                if (!cancelled) setProjectAbbr('');
            });
        return () => { cancelled = true; };
    }, [apiBaseUrl]);

    useEffect(() => {
        // build tree from filtered items
        const filtered = items.filter(i => filterType === 'ALL' ? true : i.type === filterType);
        const map = {};
        filtered.forEach(i => { map[i.id] = { ...i, children: [] }; });
        const roots = [];
        filtered.forEach(i => {
            if (i.parent_id) {
                if (map[i.parent_id]) map[i.parent_id].children.push(map[i.id]);
            } else {
                roots.push(map[i.id]);
            }
        });

        const derivedNodes = filtered.filter(i => i.derive_from && map[i.derive_from] && map[i.id]);
        derivedNodes.forEach((node) => {
            const derived = map[node.id];
            const source = map[node.derive_from];
            if (!derived || !source) return;

            // Only reposition when derived shares the same parent as source.
            // If derived was intentionally attached elsewhere (e.g., copied under a derived root), keep it where it is.
            const sameParent = (derived.parent_id ?? null) === (source.parent_id ?? null);
            if (!sameParent) return;

            const removeFromParent = () => {
                if (derived.parent_id && map[derived.parent_id]) {
                    map[derived.parent_id].children = map[derived.parent_id].children.filter(
                        (child) => child.id !== derived.id
                    );
                } else {
                    const index = roots.findIndex((root) => root.id === derived.id);
                    if (index >= 0) {
                        roots.splice(index, 1);
                    }
                }
            };

            removeFromParent();

            const siblings = source.parent_id && map[source.parent_id]
                ? map[source.parent_id].children
                : roots;
            const sourceIndex = siblings.findIndex((item) => item.id === source.id);
            if (sourceIndex < 0) return;
            siblings.splice(sourceIndex + 1, 0, derived);
        });

        setTree(roots);
    }, [items, filterType]);

    const itemById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            if (item && typeof item.id !== 'undefined') {
                map.set(item.id, item);
            }
        });
        return map;
    }, [items]);

    const derivedChildrenSet = useMemo(() => {
        const set = new Set();
        items.forEach((item) => {
            if (item?.derive_from) {
                set.add(item.derive_from);
            }
        });
        return set;
    }, [items]);

    const refresh = () => fetchAll();

    const handleDerive = async (node, level = 0) => {
        if (!apiBaseUrl.includes('/project/')) {
            setMessage('파생 생성은 프로젝트 화면에서만 가능합니다.');
            return;
        }

        const suffix = window.prompt('파생 항목 접미 설명을 입력하세요. 예: 현장데이터');
        const trimmed = (suffix || '').trim();
        if (!trimmed) {
            setMessage('접미 설명은 필수입니다.');
            return;
        }

        try {
            const res = await fetch(`${apiBaseUrl}/standard-items/${node.id}/derive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suffix_description: trimmed, work_master_id: node?.selected_work_master_id ?? null }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || '파생 항목을 생성할 수 없습니다.');
            }
            const derived = await res.json();
            setItems((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                return [...list, derived];
            });
            setMessage('파생 항목이 생성되었습니다.');
            selectNode(derived.id, level, derived);
            refresh();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '파생 항목 생성에 실패했습니다.');
        }
    };

    const handleDeriveGwmLevel1 = async (node) => {
        if (!apiBaseUrl.includes('/project/')) {
            setMessage('파생 생성은 프로젝트 화면에서만 가능합니다.');
            return;
        }

        const suffix = window.prompt('레벨1 파생 항목 이름을 입력하세요. 예: 현장데이터');
        const trimmed = (suffix || '').trim();
        if (!trimmed) {
            setMessage('이름 입력은 필수입니다.');
            return;
        }

        const derivedName = projectAbbr ? `${trimmed} [${projectAbbr}]` : trimmed;

        try {
            const deriveRes = await fetch(`${apiBaseUrl}/standard-items/${node.id}/derive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suffix_description: derivedName, work_master_id: null }),
            });
            if (!deriveRes.ok) {
                const text = await deriveRes.text();
                throw new Error(text || '파생 항목을 생성할 수 없습니다.');
            }
            const derivedRoot = await deriveRes.json();

            const children = items.filter((item) => item.parent_id === node.id);
            if (children.length) {
                for (const child of children) {
                    const res = await fetch(`${apiBaseUrl}/standard-items/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: child.name,
                            type: child.type,
                            parent_id: derivedRoot.id,
                            derive_from: child.id,
                        }),
                    });
                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(text || '하위 항목 복제에 실패했습니다.');
                    }
                }
            }

            setItems((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                return [...list, derivedRoot];
            });
            setMessage('레벨1 파생 항목이 생성되었습니다.');
            selectNode(derivedRoot.id, 1, derivedRoot);
            refresh();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '파생 항목 생성에 실패했습니다.');
        }
    };

    // select a node (no separate children fetch needed since tree is built client-side)
    const selectNode = (id, depth, node) => {
        setSelected(id);
        if (onNodeSelect) {
            try {
                onNodeSelect({ id, depth, node });
            } catch (error) {
                console.error('Error notifying node selection', error);
            }
        }
    };

    const handleAdd = (parentId) => {
        // open inline add form: parentId === null for root, otherwise child
        setAddingForParent(parentId);
        setNewName('');
        // default newType: if adding child and parent exists, inherit parent's type
        if (parentId) {
            const p = items.find(i => i.id === parentId);
            setNewType(p ? p.type : 'GWM');
        } else {
            setNewType('GWM');
        }
    };

    const cancelAdd = () => {
        setAddingForParent(undefined);
        setNewName('');
    };

    const submitCreate = async () => {
        const parentId = addingForParent === undefined ? null : addingForParent;
        const name = (newName || '').trim();
        const type = newType;
        if (!name) {
            setMessage('이름을 입력하세요');
            return;
        }
        try {
            const res = await fetch(`${apiBaseUrl}/standard-items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, parent_id: parentId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '생성 실패');
            }
            setMessage('생성 성공');
            cancelAdd();
            refresh();
        } catch (e) {
            setMessage(e.message);
        }
    };

    // focus input when inline add form opens
    useEffect(() => {
        if (addingForParent !== undefined) {
            // wait for DOM update
            setTimeout(() => {
                try {
                    inputRef.current && inputRef.current.focus();
                } catch (error) {
                    console.error('Failed to focus input', error);
                }
            }, 0);
        }
    }, [addingForParent]);

    const normalizedExternalSelection = useMemo(() => {
        const normalized = new Set();
        (Array.isArray(externalCheckboxSelection) ? externalCheckboxSelection : []).forEach((value) => {
            if (value != null) {
                normalized.add(Number(value));
            }
        });
        return normalized;
    }, [externalCheckboxSelection]);

    const prevExternalSelection = useRef(new Set());

    useEffect(() => {
        if (!level2CheckboxesEnabled) {
            if (checkboxSelection.size) {
                setCheckboxSelection(new Set());
            }
            prevExternalSelection.current = new Set();
            return;
        }
    }, [level2CheckboxesEnabled, checkboxSelection.size]);

    useEffect(() => {
        if (!level2CheckboxesEnabled) {
            return;
        }

        if (setsAreEqual(prevExternalSelection.current, normalizedExternalSelection)) {
            return;
        }

        prevExternalSelection.current = new Set(normalizedExternalSelection);
        setCheckboxSelection(new Set(normalizedExternalSelection));
    }, [level2CheckboxesEnabled, normalizedExternalSelection]);

    useEffect(() => {
        if (onCheckboxSelectionChange) {
            onCheckboxSelectionChange(Array.from(checkboxSelection));
        }
    }, [checkboxSelection, onCheckboxSelectionChange]);

    const handleDelete = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까? (하위 항목도 함께 삭제될 수 있습니다)')) return;
        try {
            const res = await fetch(`${apiBaseUrl}/standard-items/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '삭제 실패');
            }
            setMessage('삭제 성공');
            if (selected === id) {
                setSelected(null);
                if (onNodeSelect) onNodeSelect(null);
            }
            refresh();
        } catch (e) {
            setMessage(e.message);
        }
    };

    const startEdit = (node) => {
        setEditingId(node.id);
        setEditingName(node.name || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    const saveEdit = async (id) => {
        const name = (editingName || '').trim();
        if (!name) { setMessage('이름을 입력하세요'); return; }
        try {
            const res = await fetch(`${apiBaseUrl}/standard-items/${id}/rename`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
            });
            if (!res.ok) {
                const err = await res.json(); throw new Error(err.detail || '수정 실패');
            }
            setMessage('수정 성공');
            cancelEdit();
            refresh();
        } catch (e) { setMessage(e.message); }
    };

    const flattenNodes = useMemo(() => {
        const list = [];
        const traverse = (nodes, depth = 0) => {
            nodes.forEach(node => {
                list.push({ ...node, depth });
                if (node.children && node.children.length) {
                    traverse(node.children, depth + 1);
                }
            });
        };
        traverse(tree);
        return list;
    }, [tree]);

    const nodeRegistry = useMemo(() => {
        const map = new Map();
        flattenNodes.forEach(({ id, depth, children, ...rest }) => {
            map.set(id, { node: { id, ...rest, children }, depth });
        });
        return map;
    }, [flattenNodes]);

    useEffect(() => {
        if (externalSelectedId == null) return;
        if (selected === externalSelectedId) return;
        const entry = nodeRegistry.get(externalSelectedId);
        if (!entry) return;
        selectNode(externalSelectedId, entry.depth, entry.node);
        scrollMatchIntoView(externalSelectedId);
    }, [externalSelectedId, nodeRegistry, selected]);

    const toggleCollapse = (nodeId) => {
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    const matchSet = useMemo(() => new Set(matchIds), [matchIds]);

    const handleSearch = () => {
        const term = (searchTerm || '').trim().toLowerCase();
        if (!term) {
            setMatchIds([]);
            setMatchIndex(-1);
            return;
        }
        const matches = flattenNodes
            .filter(n => (n.name || '').toLowerCase().includes(term))
            .map(n => n.id);
        setMatchIds(matches);
        if (!matches.length) {
            setMatchIndex(-1);
            return;
        }
        setMatchIndex(0);
        const firstMatch = nodeRegistry.get(matches[0]);
        if (firstMatch) {
            selectNode(matches[0], firstMatch.depth, firstMatch.node);
            scrollMatchIntoView(matches[0]);
        }
    };

    const cycleMatch = () => {
        if (!matchIds.length) return;
        const nextIndex = matchIndex < 0 ? 0 : (matchIndex + 1) % matchIds.length;
        setMatchIndex(nextIndex);
        const matchId = matchIds[nextIndex];
        const entry = nodeRegistry.get(matchId);
        if (entry) {
            selectNode(matchId, entry.depth, entry.node);
            scrollMatchIntoView(matchId);
        }
    };

    const smallBtn = { padding: '4px 6px', fontSize: 12 };
    const headerButtonStyle = { padding: '4px 10px', fontSize: 12 };
    const collapseButtonStyle = {
        width: 24,
        height: 24,
        padding: 0,
        marginRight: 4,
        borderRadius: 4,
        border: '1px solid #ccc',
        background: '#fff',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const renderNode = (node, level = 0) => {
        const isMatch = matchSet.has(node.id);
        const indent = level * 12;
        const hasChildren = node.children && node.children.length > 0;
        if (level >= viewLevel) return null;
        const isCollapsed = collapsedNodes.has(node.id);
        const shouldRenderChildren = hasChildren && level + 1 < viewLevel;
        const allowCheckbox = level2CheckboxesEnabled && level === checkboxDepth;
        const isLevel2Checked = checkboxSelection.has(node.id);
        const isDerived = Boolean(node.derive_from);
        const parentName = isDerived ? itemById.get(node.derive_from)?.name : null;
        const childName = isDerived
            ? (node.name || '').replace(/\s*\[[^\]]*]\s*$/, '').trim() || node.name
            : node.name;
        const derivedLabel = isDerived
            ? `${parentName ?? '부모'}${projectAbbr ? ` [${projectAbbr}]` : ''}::${childName}`
            : node.name;
        const isDerivedUnselected = isDerived && !node.selected_work_master_id;
        const isLevel2Gwm = level === 2 && (node.type ?? '').toUpperCase() === 'GWM';
        const isLevel2GwmUnselected = isLevel2Gwm && !node.selected_work_master_id;
        const isUnselectedHighlight = isProjectContext && (isDerivedUnselected || isLevel2GwmUnselected);
        const isSwm = (node.type ?? '').toUpperCase() === 'SWM';
        const hasDerivedChild = derivedChildrenSet.has(node.id);
        const isBaseSwmNotDerived = isProjectContext && isSwm && !isDerived && level === 2 && !hasDerivedChild;
        return (
            <div
                key={node.id}
                ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                }}
                style={{ marginLeft: indent, padding: '6px 0', background: isMatch ? '#fff7c1' : 'transparent', borderRadius: 4 }}
            >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: indent, height: '100%' }}>
                    {level > 0 && (
                        <span
                            style={{
                                position: 'absolute',
                                left: Math.max(indent - 6, 0),
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: '#ccc',
                                borderRadius: 1,
                            }}
                        />
                    )}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {hasChildren && level + 1 < viewLevel && (
                        <button
                            type="button"
                            aria-label={isCollapsed ? '펼치기' : '접기'}
                            style={collapseButtonStyle}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse(node.id);
                            }}
                        >
                            {isCollapsed ? '+' : '-'}
                        </button>
                    )}
                    <div style={{ flex: 1 }}>
                        {editingId === node.id ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ padding: 6, width: 220 }} onKeyDown={(e) => { if (e.key==='Enter') saveEdit(node.id); if (e.key==='Escape') cancelEdit(); }} />
                                <button style={{ ...smallBtn }} onClick={() => saveEdit(node.id)}>저장</button>
                                <button style={{ ...smallBtn }} onClick={cancelEdit}>취소</button>
                            </div>
                        ) : (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => selectNode(node.id, level, node)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        selectNode(node.id, level, node);
                                    }
                                }}
                                style={{
                                    cursor: 'pointer',
                                    fontWeight: node.id === selected ? '600' : '400',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: isUnselectedHighlight ? '#b91c1c' : undefined,
                                }}
                            >
                                {allowCheckbox && (
                                    <input
                                        type="checkbox"
                                        checked={isLevel2Checked}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            setCheckboxSelection((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(node.id)) next.delete(node.id);
                                                else next.add(node.id);
                                                return next;
                                            });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: 16, height: 16 }}
                                    />
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {level === 2 && (
                                        <span style={{ fontWeight: 600, fontSize: 12 }}>▸</span>
                                    )}
                                    <span
                                        style={{
                                            fontSize: 12,
                                            background: isDerived ? '#ede9fe' : undefined,
                                            padding: isDerived ? '2px 6px' : undefined,
                                            borderRadius: isDerived ? 6 : undefined,
                                        }}
                                    >
                                        {derivedLabel} <small style={{ color: '#666', fontSize: 10 }}>({node.type})</small>
                                        {isDerived && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    marginLeft: 4,
                                                    padding: '1px 4px',
                                                    borderRadius: 4,
                                                    background: '#e0e7ff',
                                                    color: '#3730a3',
                                                }}
                                            >
                                                파생
                                            </span>
                                        )}
                                        {isUnselectedHighlight && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    marginLeft: 4,
                                                    padding: '1px 4px',
                                                    borderRadius: 4,
                                                    background: '#fee2e2',
                                                    color: '#b91c1c',
                                                }}
                                            >
                                                미선택
                                            </span>
                                        )}
                                        {isBaseSwmNotDerived && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    marginLeft: 4,
                                                    padding: '1px 4px',
                                                    borderRadius: 4,
                                                    background: '#fef08a',
                                                    color: '#854d0e',
                                                }}
                                            >
                                                미파생
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    {level < 2 && (
                        <button style={{ marginLeft: 8, ...smallBtn }} onClick={() => handleAdd(node.id)}>추가</button>
                    )}
                    {level === 1 && (node.type ?? '').toUpperCase() === 'GWM' && (
                        <button
                            style={{ marginLeft: 6, ...smallBtn }}
                            onClick={() => handleDeriveGwmLevel1(node)}
                        >파생생성</button>
                    )}
                    {level === 2 && (node.type ?? '').toUpperCase() !== 'GWM' && !isDerived && (
                        <button
                            style={{ marginLeft: 6, ...smallBtn }}
                            onClick={() => handleDerive(node, level)}
                        >파생생성</button>
                    )}
                    <button style={{ marginLeft: 6, ...smallBtn }} onClick={() => startEdit(node)}>수정</button>
                    <button style={{ marginLeft: 6, ...smallBtn }} onClick={() => handleDelete(node.id)}>삭제</button>
                </div>
            </div>
            {!isCollapsed && shouldRenderChildren && (
                <div>
                    {node.children.map(c => renderNode(c, level + 1)).filter(Boolean)}
                </div>
            )}
        </div>
        );
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h2 style={{ fontSize: 14, marginBottom: 8, paddingLeft: 8 }}>Standard GWM Tree</h2>
            {message && <div style={{ color: 'red' }}>{message}</div>}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div ref={treeContainerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e6e6e6', padding: 8, maxWidth: '100%', position: 'relative' }}>
                    <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, paddingBottom: 8, borderBottom: '1px solid #e6e6e6' }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div>
                                <button style={headerButtonStyle} onClick={() => handleAdd(null)}>루트 항목 추가</button>
                                <button style={{ ...headerButtonStyle, marginLeft: 4 }} onClick={refresh}>새로고침</button>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <label htmlFor="view-level" style={{ fontSize: 11, color: '#444' }}>레벨</label>
                                    <select
                                        id="view-level"
                                        value={viewLevel}
                                        onChange={(e) => setViewLevel(Number(e.target.value))}
                                        style={{ padding: '2px 4px', fontSize: 11, borderRadius: 4, border: '1px solid #ccc', minWidth: 60 }}
                                    >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                        <option value={3}>3</option>
                                    </select>
                                </div>
                                <div>
                                <span style={{ marginRight: 8, color: '#555', fontSize: 11 }}>필터:</span>
                                <button onClick={() => setFilterType('ALL')} style={{ ...headerButtonStyle, fontSize: 11, fontWeight: filterType === 'ALL' ? '700' : '400' }}>All</button>
                                <button onClick={() => setFilterType('GWM')} style={{ ...headerButtonStyle, marginLeft: 6, fontSize: 11, fontWeight: filterType === 'GWM' ? '700' : '400' }}>GWM</button>
                                <button onClick={() => setFilterType('SWM')} style={{ ...headerButtonStyle, marginLeft: 6, fontSize: 11, fontWeight: filterType === 'SWM' ? '700' : '400' }}>SWM</button>
                            </div>
                        </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <input
                                placeholder="Standard GWM Tree 검색"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                                style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                            />
                            <button style={headerButtonStyle} onClick={handleSearch}>검색</button>
                            <button style={headerButtonStyle} onClick={cycleMatch} disabled={!matchIds.length}>다음</button>
                            <span style={{ fontSize: 13, color: '#666' }}>{matchIds.length ? `${matchIndex + 1}/${matchIds.length} 개 일치` : '검색 결과 없음'}</span>
                        </div>
                        {addingForParent !== undefined && (
                            <div style={{ marginBottom: 8, padding: 8, border: '1px dashed #ccc' }}>
                                <div style={{ marginBottom: 6 }}>
                                    <input
                                        ref={inputRef}
                                        placeholder="항목 이름"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                submitCreate();
                                            } else if (e.key === 'Escape') {
                                                cancelAdd();
                                            }
                                        }}
                                        style={{ padding: 6, width: 240, background: '#fff8a3' }}
                                    />
                                </div>
                                {addingForParent === null ? (
                                    <div style={{ marginBottom: 6 }}>
                                        <button onClick={() => setNewType('GWM')} style={{ ...headerButtonStyle, fontWeight: newType === 'GWM' ? '700' : '400' }}>GWM</button>
                                        <button onClick={() => setNewType('SWM')} style={{ ...headerButtonStyle, marginLeft: 8, fontWeight: newType === 'SWM' ? '700' : '400' }}>SWM</button>
                                    </div>
                                ) : (
                                    <div style={{ marginBottom: 6, color: '#444' }}>부모 타입을 자동 상속: {newType}</div>
                                )}
                                <div>
                                    <button style={headerButtonStyle} onClick={submitCreate}>생성</button>
                                    <button onClick={cancelAdd} style={{ ...headerButtonStyle, marginLeft: 8 }}>취소</button>
                                </div>
                            </div>
                        )}
                    </div>

                        <div style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        {tree.map(n => renderNode(n))}
                    </div>
                </div>
            </div>
        </div>
    );
}


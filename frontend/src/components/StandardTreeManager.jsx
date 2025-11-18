import React, { useEffect, useState, useRef } from 'react';

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export default function StandardTreeManager({ onNodeSelect }) {
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

    const fetchAll = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/standard-items/`);
            if (!res.ok) throw new Error('표준 항목 조회 실패');
            const data = await res.json();
            setItems(data);
        } catch (e) {
            setMessage(e.message);
        }
    };

    useEffect(() => { fetchAll(); }, []);

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
        setTree(roots);
    }, [items, filterType]);

    const refresh = () => fetchAll();

    // select a node (no separate children fetch needed since tree is built client-side)
    const selectNode = (id, depth, node) => {
        setSelected(id);
        if (onNodeSelect) {
            try {
                onNodeSelect({ id, depth, node });
            } catch (e) {}
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
            const res = await fetch(`${API_BASE_URL}/standard-items/`, {
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
                try { inputRef.current && inputRef.current.focus(); } catch (e) {}
            }, 0);
        }
    }, [addingForParent]);

    const handleDelete = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까? (하위 항목도 함께 삭제될 수 있습니다)')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/standard-items/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`${API_BASE_URL}/standard-items/${id}/rename`, {
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

    const smallBtn = { padding: '4px 6px', fontSize: 12 };

    const renderNode = (node, level = 0) => (
        <div key={node.id} style={{ marginLeft: level * 12, padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    {editingId === node.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ padding: 6, width: 220 }} onKeyDown={(e) => { if (e.key==='Enter') saveEdit(node.id); if (e.key==='Escape') cancelEdit(); }} />
                            <button style={{ ...smallBtn }} onClick={() => saveEdit(node.id)}>저장</button>
                            <button style={{ ...smallBtn }} onClick={cancelEdit}>취소</button>
                        </div>
                    ) : (
                        <span
                            onClick={() => selectNode(node.id, level, node)}
                            style={{ cursor: 'pointer', fontWeight: node.id === selected ? '600' : '400' }}
                        >
                            {node.name} <small style={{ color: '#666' }}>({node.type})</small>
                        </span>
                    )}
                </div>
                <div>
                    {level < 2 && (
                        <button style={{ marginLeft: 8, ...smallBtn }} onClick={() => handleAdd(node.id)}>추가</button>
                    )}
                    <button style={{ marginLeft: 6, ...smallBtn }} onClick={() => startEdit(node)}>수정</button>
                    <button style={{ marginLeft: 6, ...smallBtn }} onClick={() => handleDelete(node.id)}>삭제</button>
                </div>
            </div>
            {node.children && node.children.length > 0 && (
                <div>
                    {node.children.map(c => renderNode(c, level + 1))}
                </div>
            )}
        </div>
    );

    return (
        <div>
            <h2>Standard Tree</h2>
            {message && <div style={{ color: 'red' }}>{message}</div>}
            <div>
                <div style={{ maxHeight: '680px', overflow: 'auto', overflowX: 'auto', border: '1px solid #e6e6e6', padding: 8, maxWidth: '100%' }}>
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                            <button onClick={() => handleAdd(null)}>루트 항목 추가</button>
                            <button style={{ marginLeft: 8 }} onClick={refresh}>새로고침</button>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <span style={{ marginRight: 8, color: '#555' }}>필터:</span>
                            <button onClick={() => setFilterType('ALL')} style={{ fontWeight: filterType === 'ALL' ? '700' : '400' }}>All</button>
                            <button onClick={() => setFilterType('GWM')} style={{ marginLeft: 6, fontWeight: filterType === 'GWM' ? '700' : '400' }}>GWM</button>
                            <button onClick={() => setFilterType('SWM')} style={{ marginLeft: 6, fontWeight: filterType === 'SWM' ? '700' : '400' }}>SWM</button>
                        </div>
                    </div>

                    {/* Inline add form */}
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
                                    style={{ padding: 6, width: 240 }}
                                />
                            </div>
                            {addingForParent === null ? (
                                <div style={{ marginBottom: 6 }}>
                                    <button onClick={() => setNewType('GWM')} style={{ fontWeight: newType === 'GWM' ? '700' : '400' }}>GWM</button>
                                    <button onClick={() => setNewType('SWM')} style={{ marginLeft: 8, fontWeight: newType === 'SWM' ? '700' : '400' }}>SWM</button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: 6, color: '#444' }}>부모 타입을 자동 상속: {newType}</div>
                            )}
                            <div>
                                <button onClick={submitCreate}>생성</button>
                                <button onClick={cancelAdd} style={{ marginLeft: 8 }}>취소</button>
                            </div>
                        </div>
                    )}

                    {tree.map(n => renderNode(n))}
                </div>
            </div>
        </div>
    );
}


import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";
const buttonStyle = { fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' };

export default function StandardGwmMatcher({ selectedNode, onTreeRefresh }) {
    const [standardItems, setStandardItems] = useState([]);
    const [workMasters, setWorkMasters] = useState([]);
    const [assignedSet, setAssignedSet] = useState(new Set());
    const [message, setMessage] = useState('');
    const [wmInput, setWmInput] = useState('');
    const [wmFilter, setWmFilter] = useState('');
    const [loadingSave, setLoadingSave] = useState(false);
    const [copySnapshot, setCopySnapshot] = useState(null);
    const [pasteLoading, setPasteLoading] = useState(false);

    const childrenMap = useMemo(() => {
        const map = new Map();
        standardItems.forEach(item => {
            const parentId = item.parent_id ?? null;
            if (!map.has(parentId)) map.set(parentId, []);
            map.get(parentId).push(item);
        });
        return map;
    }, [standardItems]);

    const fetchData = async () => {
        try {
            const [stdRes, wmRes] = await Promise.all([
                fetch(`${API_BASE_URL}/standard-items/`),
                fetch(`${API_BASE_URL}/work-masters/`),
            ]);
            if (!stdRes.ok) throw new Error('표준 항목을 가져오는 데 실패했습니다');
            if (!wmRes.ok) throw new Error('워크마스터 데이터를 가져오는 데 실패했습니다');
            const [stdData, wmData] = await Promise.all([stdRes.json(), wmRes.json()]);
            setStandardItems(stdData);
            setWorkMasters(wmData);
        } catch (e) {
            setMessage(e.message || '데이터 로드에 실패했습니다');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!selectedNode || !selectedNode.id || selectedNode.depth < 2) {
            setAssignedSet(new Set());
            return;
        }
        const existing = standardItems.find(item => item.id === selectedNode.id);
        if (existing) {
            setAssignedSet(new Set((existing.work_masters || []).map(w => w.id)));
            return;
        }
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}`);
                if (!res.ok) throw new Error('선택 항목 상세를 불러오지 못했습니다');
                const data = await res.json();
                setAssignedSet(new Set((data.work_masters || []).map(w => w.id)));
            } catch (e) {
                setAssignedSet(new Set());
            }
        })();
    }, [selectedNode, standardItems]);

    const filteredWorkMasters = useMemo(() => {
        const candidates = workMasters.filter(w => (w.new_old_code || '').toLowerCase() !== 'old');
        const filterText = (wmFilter || '').trim().toLowerCase();
        if (!filterText) return candidates;
        const terms = filterText.split('|').map(term => term.trim()).filter(Boolean);
        return candidates.filter(w => {
            const haystack = [w.work_master_code, w.cat_large_desc, w.cat_mid_desc, w.cat_small_desc]
                .filter(Boolean)
                .map(text => text.toLowerCase());
            return terms.every(term => haystack.some(entry => entry.includes(term)));
        });
    }, [workMasters, wmFilter]);

    const filteredAssigned = useMemo(() => {
        return Array.from(assignedSet).map(id => workMasters.find(w => w.id === id)).filter(Boolean);
    }, [assignedSet, workMasters]);

    const toggleAssignLocal = (wmId) => {
        setAssignedSet(prev => {
            const next = new Set(prev);
            if (next.has(wmId)) next.delete(wmId);
            else next.add(wmId);
            return next;
        });
    };

    const handleSaveAssignments = async () => {
        if (!selectedNode || !selectedNode.id || selectedNode.depth < 2) {
            setMessage('레벨2 항목을 선택한 후 저장하세요');
            return;
        }
        setLoadingSave(true);
        setMessage('저장 중...');
        try {
            const current = new Set(filteredAssigned.map(w => w.id));
            const next = assignedSet;
            const toAdd = Array.from(next).filter(id => !current.has(id));
            const toRemove = Array.from(current).filter(id => !next.has(id));
            for (const id of toAdd) {
                await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ work_master_id: Number(id) }),
                });
            }
            for (const id of toRemove) {
                await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}/remove`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ work_master_id: Number(id) }),
                });
            }
            setMessage('저장 완료');
            await fetchData();
        } catch (e) {
            setMessage(e.message || '저장 중 오류가 발생했습니다');
        } finally {
            setLoadingSave(false);
        }
    };

    const buildChildrenModel = (parentId) => {
        const children = childrenMap.get(parentId) || [];
        return children.map(child => ({
            name: child.name,
            type: child.type,
            children: buildChildrenModel(child.id),
        }));
    };

    const handleCopySubtree = () => {
        if (!selectedNode || !selectedNode.id) {
            setMessage('좌측 트리에서 항목을 선택하세요');
            return;
        }
        if (selectedNode.depth > 1) {
            setMessage('복사는 레벨0 또는 레벨1 항목의 하위 트리만 가능합니다');
            return;
        }
        const nodes = buildChildrenModel(selectedNode.id);
        if (!nodes.length) {
            setMessage('복사할 하위 항목이 없습니다');
            return;
        }
        setCopySnapshot({ nodeId: selectedNode.id, depth: selectedNode.depth, nodes });
        setMessage('하위 항목이 복사되었습니다');
    };

    const canPasteSubtree = Boolean(
        copySnapshot &&
        selectedNode &&
        selectedNode.id !== copySnapshot.nodeId &&
        selectedNode.depth === copySnapshot.depth &&
        copySnapshot.nodes.length > 0
    );

    const duplicateNodes = async (nodes, parentId) => {
        for (const node of nodes) {
            const res = await fetch(`${API_BASE_URL}/standard-items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: node.name,
                    type: node.type,
                    parent_id: parentId,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || '하위 항목 생성 실패');
            }
            const created = await res.json();
            if (node.children && node.children.length) {
                await duplicateNodes(node.children, created.id);
            }
        }
    };

    const handlePasteSubtree = async () => {
        if (!canPasteSubtree || !selectedNode) return;
        setPasteLoading(true);
        setMessage('하위 항목을 붙여넣는 중입니다...');
        try {
            await duplicateNodes(copySnapshot.nodes, selectedNode.id);
            setMessage('하위 항목 붙여넣기 완료');
            onTreeRefresh && onTreeRefresh();
            await fetchData();
        } catch (e) {
            setMessage(e.message || '붙여넣기 중 오류가 발생했습니다');
        } finally {
            setPasteLoading(false);
        }
    };

    const hasTreeChildren = Boolean(selectedNode && (childrenMap.get(selectedNode.id) || []).length);
    const isCopyMode = selectedNode && selectedNode.depth <= 1;
    const isMatcherMode = selectedNode && selectedNode.depth >= 2;
    const selectedLabel = selectedNode?.node?.name || selectedNode?.id || '항목을 선택해주세요';
    const selectedType = selectedNode?.node?.type || '';

    return (
        <div style={{ paddingTop: 0, width: '100%', maxWidth: '50vw', minWidth: 320, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
            <h2 style={{ margin: 0, padding: 0 }}>{isCopyMode ? 'Std-Items 트리 복사' : 'WorkMaster 매칭'}</h2>
            {message && <p style={{ margin: '4px 0 8px', lineHeight: 1.4 }}><strong>알림:</strong> {message}</p>}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: '1px solid #ccc', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!selectedNode && (
                    <div style={{ padding: 16, color: '#666', textAlign: 'center' }}>
                        좌측 트리에서 항목을 선택하면 기능이 활성화됩니다
                    </div>
                )}
                {isCopyMode && selectedNode && (
                    <>
                        <div>
                            <div style={{ marginBottom: 6 }}>
                                <strong>선택 항목:</strong> {selectedLabel} <small style={{ color: '#666' }}>({selectedType})</small>
                            </div>
                            <div style={{ fontSize: 13, color: '#444' }}>
                                이 항목의 하위 트리를 복사 후 같은 레벨의 다른 항목 아래에 붙여넣을 수 있습니다.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                                type="button"
                                style={buttonStyle}
                                onClick={handleCopySubtree}
                                disabled={!hasTreeChildren}
                            >
                                하위 항목 복사
                            </button>
                            <button
                                type="button"
                                style={buttonStyle}
                                onClick={handlePasteSubtree}
                                disabled={!canPasteSubtree || pasteLoading}
                            >
                                {pasteLoading ? '붙여넣기 진행 중...' : '하위 항목 붙여넣기'}
                            </button>
                            <span style={{ fontSize: 12, color: '#777' }}>
                                {copySnapshot && !canPasteSubtree ? '다른 동일 레벨 항목을 선택하면 붙여넣기가 활성화됩니다.' : ''}
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                            복사는 선택한 항목의 직접 자식부터 시작하며, 붙여넣기는 같은 레벨의 다른 항목 아래에 새로운 트리를 생성합니다.
                        </div>
                    </>
                )}
                {isMatcherMode && selectedNode && (
                    <>
                        <div style={{ marginBottom: 8 }}>
                            <strong>선택 항목:</strong> {selectedLabel} <small style={{ color: '#666' }}>({selectedType})</small>
                        </div>
                        <div style={{ display: 'flex', gap: 12, minWidth: 0, height: '100%' }}>
                            <div style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 12, maxWidth: 420, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input
                                            placeholder="WorkMaster 검색"
                                            value={wmInput}
                                            onChange={(e) => setWmInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setWmFilter(wmInput);
                                                }
                                            }}
                                            style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                                        />
                                        <button type="button" style={buttonStyle} onClick={() => setWmFilter(wmInput)}>검색</button>
                                    </div>
                                </div>
                                <div style={{ marginBottom: 4 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                        <input
                                            type="checkbox"
                                            checked={filteredWorkMasters.length > 0 && filteredWorkMasters.every(w => assignedSet.has(w.id))}
                                            disabled={!wmFilter.trim()}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setAssignedSet(prev => {
                                                    const next = new Set(prev);
                                                    filteredWorkMasters.forEach(w => {
                                                        if (checked) next.add(w.id);
                                                        else next.delete(w.id);
                                                    });
                                                    return next;
                                                });
                                            }}
                                        />
                                        필터 결과 전체 선택
                                    </label>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', border: '1px solid #f0f0f0', padding: 6, background: '#fff' }}>
                                    {filteredWorkMasters.map(w => {
                                        const attrs = [w.attr1_spec, w.attr2_spec, w.attr3_spec, w.attr4_spec, w.attr5_spec, w.attr6_spec].filter(Boolean).join(' | ');
                                        return (
                                            <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 6px', borderBottom: '1px solid #f5f5f5' }}>
                                                <div style={{ marginTop: 6 }}>
                                                    <input type="checkbox" checked={assignedSet.has(w.id)} onChange={() => toggleAssignLocal(w.id)} />
                                                </div>
                                                <div style={{ marginLeft: 10, flex: 1 }}>
                                                    <div style={{ fontWeight: 700 }}>{w.cat_large_desc || w.cat_mid_desc || w.cat_small_desc || w.work_master_code}</div>
                                                    <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{[w.cat_mid_desc, w.cat_small_desc].filter(Boolean).join(' / ')}</div>
                                                    {attrs && <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{attrs}{w.uom1 ? ` | UoM: ${w.uom1}` : ''}</div>}
                                                    {!attrs && w.uom1 && <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>UoM: {w.uom1}</div>}
                                                    <div style={{ fontSize: 11, color: '#c00', marginTop: 8 }}>{w.work_master_code}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!filteredWorkMasters.length && <div style={{ padding: 12, color: '#888', textAlign: 'center' }}>검색 결과가 없습니다</div>}
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 600 }}>현재 할당된 항목</span>
                                        <button style={buttonStyle} onClick={handleSaveAssignments} disabled={loadingSave}>{loadingSave ? '저장 중...' : '저장'}</button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button type="button" style={buttonStyle} onClick={() => setAssignedSet(new Set())}>전체 제거</button>
                                        <button type="button" style={buttonStyle} onClick={() => setMessage('현재 할당 항목이 복사되었습니다')}>복사</button>
                                    </div>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #f0f0f0', maxHeight: 'calc(100vh - 360px)', background: '#fff' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {filteredAssigned.map(w => {
                                                const attrs = [w.attr1_spec, w.attr2_spec, w.attr3_spec, w.attr4_spec, w.attr5_spec, w.attr6_spec].filter(Boolean).join(' | ');
                                                return (
                                                    <tr key={w.id}>
                                                        <td style={{ padding: 8, borderBottom: '1px solid #f6f6f6' }}>
                                                            <div style={{ fontWeight: 700 }}>{w.cat_large_desc || w.cat_mid_desc || w.cat_small_desc || w.work_master_code}</div>
                                                            <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{[w.cat_mid_desc, w.cat_small_desc].filter(Boolean).join(' / ')}</div>
                                                            {attrs && <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{attrs}{w.uom1 ? ` | UoM: ${w.uom1}` : ''}</div>}
                                                            {!attrs && w.uom1 && <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>UoM: {w.uom1}</div>}
                                                            <div style={{ fontSize: 11, color: '#c00', marginTop: 8 }}>{w.work_master_code}</div>
                                                        </td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid #f6f6f6', width: 80, textAlign: 'center' }}>
                                                            <button style={buttonStyle} onClick={() => toggleAssignLocal(w.id)}>제거</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {!filteredAssigned.length && (
                                                <tr>
                                                    <td style={{ padding: 12, textAlign: 'center', color: '#888' }}>할당된 항목이 없습니다</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                {selectedNode && !isCopyMode && !isMatcherMode && (
                    <div style={{ padding: 16, color: '#666', textAlign: 'center' }}>
                        레벨 0~1 항목은 복사/붙여넣기, 레벨2 항목은 WorkMaster 매칭을 사용합니다.
                    </div>
                )}
            </div>
        </div>
    );
}

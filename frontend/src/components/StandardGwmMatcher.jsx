import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export default function StandardGwmMatcher({ selectedNode }) {
    const [standardItems, setStandardItems] = useState([]);
    const [workMasters, setWorkMasters] = useState([]);
    const [selectedMap, setSelectedMap] = useState({});
    const [message, setMessage] = useState('');
    const [assignedSet, setAssignedSet] = useState(new Set());
    // wmInput: current text in the input box
    // wmFilter: the active query used for filtering (applies when user presses Enter or clicks Search)
    const [wmInput, setWmInput] = useState('');
    const [wmFilter, setWmFilter] = useState('');
    const [clipboard, setClipboard] = useState([]);
    const [loadingSave, setLoadingSave] = useState(false);
    const buttonStyle = { fontSize: 12, padding: '4px 10px' };

    const filteredWorkMasters = useMemo(() => {
        const q = wmFilter.trim();
        const candidates = workMasters.filter(w => w.new_old_code !== 'Old');
        if (!q) return candidates;
        const terms = q.split('|').map(term => term.trim().toLowerCase()).filter(Boolean);
        return candidates.filter(w => {
            const matchText = [
                w.work_master_code,
                w.cat_large_desc,
                w.cat_mid_desc,
                w.cat_small_desc
            ].filter(Boolean).map(x => x.toLowerCase());
            return terms.every(term => matchText.some(text => text.includes(term)));
        });
    }, [workMasters, wmFilter]);

    const fetchData = async () => {
        try {
            const [stdRes, wmRes] = await Promise.all([
                fetch(`${API_BASE_URL}/standard-items/`),
                fetch(`${API_BASE_URL}/work-masters/`),
            ]);
            if (!stdRes.ok) throw new Error('Standard items fetch failed');
            if (!wmRes.ok) throw new Error('Work masters fetch failed');
            const stdData = await stdRes.json();
            const wmData = await wmRes.json();
            setStandardItems(stdData);
            setWorkMasters(wmData);

            // prefill selected map with first matched work master if exists
            const map = {};
            stdData.forEach(s => {
                if (s.work_masters && s.work_masters.length > 0) {
                    map[s.id] = s.work_masters[0].id;
                }
            });
            setSelectedMap(map);
            // initialize assignedSet for current selection if available
            if (selectedNode && selectedNode.id) {
                const cur = stdData.find(s => s.id === selectedNode.id);
                setAssignedSet(new Set((cur && cur.work_masters ? cur.work_masters.map(w => w.id) : [])));
            }
        } catch (e) {
            setMessage(e.message);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // update assignedSet when selection or standardItems change
    useEffect(() => {
        if (!selectedNode || !selectedNode.id) {
            setAssignedSet(new Set());
            return;
        }
        const cur = standardItems.find(s => s.id === selectedNode.id);
        if (cur) {
            setAssignedSet(new Set((cur.work_masters || []).map(w => w.id)));
        } else {
            // fallback: fetch single standard item
            (async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        setAssignedSet(new Set((data.work_masters || []).map(w => w.id)));
                    } else {
                        setAssignedSet(new Set());
                    }
                } catch (e) { setAssignedSet(new Set()); }
            })();
        }
    }, [selectedNode, standardItems]);

    const handleSelectChange = (standardId, workMasterId) => {
        setSelectedMap(prev => ({ ...prev, [standardId]: workMasterId }));
    };

    const toggleAssignLocal = (wmId) => {
        setAssignedSet(prev => {
            const next = new Set(prev);
            if (next.has(wmId)) next.delete(wmId);
            else next.add(wmId);
            return next;
        });
    };

    const handleSaveAssignments = async () => {
        if (!selectedNode || !selectedNode.id) {
            setMessage('스탠다드 항목을 선택하세요');
            return;
        }
        setLoadingSave(true);
        setMessage('저장 중...');
        try {
            const cur = standardItems.find(s => s.id === selectedNode.id);
            const current = new Set((cur && cur.work_masters ? cur.work_masters.map(w => w.id) : []));
            const next = assignedSet;

            const toAdd = Array.from(next).filter(x => !current.has(x));
            const toRemove = Array.from(current).filter(x => !next.has(x));

            for (const id of toAdd) {
                await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}/assign`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ work_master_id: Number(id) })
                });
            }
            for (const id of toRemove) {
                await fetch(`${API_BASE_URL}/standard-items/${selectedNode.id}/remove`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ work_master_id: Number(id) })
                });
            }

            setMessage('저장 완료');
            await fetchData();
        } catch (e) {
            setMessage(e.message || '저장 실패');
        } finally {
            setLoadingSave(false);
        }
    };

        const handleCopyAssignments = () => {
            if (!selectedNode || !selectedNode.id) return setMessage('먼저 스탠다드 항목을 선택하세요');
            setClipboard(Array.from(assignedSet));
            setMessage('현재 할당 항목이 복사되었습니다');
        };

        const handlePasteAssignments = () => {
            if (!selectedNode || !selectedNode.id) return setMessage('먼저 스탠다드 항목을 선택하세요');
            if (!clipboard.length) return setMessage('복사된 항목이 없습니다');
            setAssignedSet(new Set(clipboard));
            setMessage('복사된 항목이 현재 선택에 적용되었습니다');
        };

    return (
    <div style={{ paddingTop: 0, width: '100%', maxWidth: '50vw', minWidth: 320, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0, padding: 0 }}>Std-Items 매칭</h2>
        {message && <p style={{ margin: '4px 0 8px', lineHeight: 1.2 }}><strong>상태:</strong> {message}</p>}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: '1px solid #ccc', padding: 8, maxWidth: '100%', width: '100%' }}>
                {/* If a node with depth 0 or 1 is selected, show the no-match label only */}
                {selectedNode && selectedNode.depth <= 1 ? (
                    <div style={{ padding: 16, color: '#666', textAlign: 'center', fontWeight: 600 }}>
                        이 항목에는 매칭할 수 없습니다
                    </div>
                ) : (
                    (selectedNode && selectedNode.id) ? (
                        <div>
                            <div style={{ marginBottom: 8 }}>
                                <strong>선택 항목:</strong> {selectedNode.node ? selectedNode.node.name : selectedNode.id} <small style={{ color: '#666' }}>({selectedNode.node ? selectedNode.node.type : ''})</small>
                            </div>

                                <div style={{ display: 'flex', gap: 12, minWidth: 0, height: '100%' }}>
                                <div style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 12, maxWidth: 400, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
                                    <div style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <input
                                                placeholder="WorkMaster 검색"
                                                value={wmInput}
                                                onChange={(e) => setWmInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setWmFilter(wmInput); }}
                                                style={{ flex: 1, padding: 6 }}
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
                                            전체 항목
                                        </label>
                                    </div>
                                    <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', border: '1px solid #f0f0f0', padding: 6 }}>
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
                                    </div>
                                </div>

                                <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                             <span style={{ fontWeight: 600 }}>현재 할당된 항목</span>
                                             <button style={buttonStyle} onClick={handleSaveAssignments} disabled={loadingSave}>{loadingSave ? '저장중...' : '저장'}</button>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                             <button type="button" style={buttonStyle} onClick={handleCopyAssignments}>복사</button>
                                             <button type="button" style={buttonStyle} onClick={handlePasteAssignments} disabled={clipboard.length === 0}>붙여넣기</button>
                                             <button type="button" style={buttonStyle} onClick={() => { setAssignedSet(new Set()); setMessage('모든 할당이 제거되었습니다'); }}>할당 전체 제거</button>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #f0f0f0', maxHeight: 'calc(100vh - 320px)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                        {(Array.from(assignedSet).map(id => workMasters.find(w => w.id === id)).filter(Boolean)).map(w => {
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
                                                                <td style={{ padding: 8, borderBottom: '1px solid #f6f6f6', width: 80, textAlign: 'center' }}><button style={buttonStyle} onClick={() => toggleAssignLocal(w.id)}>제거</button></td>
                                                            </tr>
                                                            );
                                                        })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: 16, color: '#666', textAlign: 'center' }}>좌측 트리에서 레벨2 항목을 선택하세요</div>
                    )
                )}
            </div>
        </div>
    );
}

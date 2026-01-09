import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';

// DB headers from discipline through new_old_code
const WORK_MASTER_CREATE_COLUMNS = [
    { key: 'discipline', label: 'discipline' },
    { key: 'cat_large_code', label: 'cat_large_code' },
    { key: 'cat_large_desc', label: 'cat_large_desc' },
    { key: 'cat_mid_code', label: 'cat_mid_code' },
    { key: 'cat_mid_desc', label: 'cat_mid_desc' },
    { key: 'cat_small_code', label: 'cat_small_code' },
    { key: 'cat_small_desc', label: 'cat_small_desc' },
    { key: 'attr1_code', label: 'attr1_code' },
    { key: 'attr1_spec', label: 'attr1_spec' },
    { key: 'attr2_code', label: 'attr2_code' },
    { key: 'attr2_spec', label: 'attr2_spec' },
    { key: 'attr3_code', label: 'attr3_code' },
    { key: 'attr3_spec', label: 'attr3_spec' },
    { key: 'attr4_code', label: 'attr4_code' },
    { key: 'attr4_spec', label: 'attr4_spec' },
    { key: 'attr5_code', label: 'attr5_code' },
    { key: 'attr5_spec', label: 'attr5_spec' },
    { key: 'attr6_code', label: 'attr6_code' },
    { key: 'attr6_spec', label: 'attr6_spec' },
    { key: 'uom1', label: 'uom1' },
    { key: 'uom2', label: 'uom2' },
    { key: 'work_group_code', label: 'work_group_code' },
    { key: 'work_master_code', label: 'work_master_code', required: true },
    { key: 'new_old_code', label: 'new_old_code' },
];

const createEmptyNewWorkMasterRow = () => {
    const row = {};
    WORK_MASTER_CREATE_COLUMNS.forEach((col) => {
        row[col.key] = '';
    });
    return row;
};

function WorkMasterManager({ apiBaseUrl = API_BASE_URL, selectedFamilyNode = null }) {
    const [workMasters, setWorkMasters] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [newWorkMasterRow, setNewWorkMasterRow] = useState(createEmptyNewWorkMasterRow());
    const [assignments, setAssignments] = useState([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [assignmentsError, setAssignmentsError] = useState('');
    const [standardItems, setStandardItems] = useState([]);

    const createBusyRef = useRef(false);
    const newWorkMasterCodeRef = useRef(null);

    const fetchWorkMasters = async (query = '') => {
        try {
            const url = query ? `${apiBaseUrl}/work-masters/?search=${query}` : `${apiBaseUrl}/work-masters/`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setWorkMasters(data);
            setMessage(query ? `'${query}'에 대한 검색 결과를 포함하여 목록을 업데이트했습니다.` : 'WorkMaster 목록을 성공적으로 불러왔습니다.');
        } catch (error) {
            setMessage(`목록 조회 실패: ${error.message}`);
        }
    };

    // 컴포넌트가 처음 렌더링될 때 목록을 불러옵니다.
    useEffect(() => {
        fetchWorkMasters();
    }, []);

    useEffect(() => {
        if (!apiBaseUrl) {
            setStandardItems([]);
            return;
        }
        let cancelled = false;
        fetch(`${apiBaseUrl}/standard-items/`)
            .then((response) => response.json())
            .then((data) => {
                if (cancelled) return;
                setStandardItems(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (cancelled) return;
                setStandardItems([]);
            });
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl]);

    useEffect(() => {
        if (!apiBaseUrl) {
            setAssignments([]);
            setAssignmentsError('');
            setAssignmentsLoading(false);
            return;
        }
        if (!selectedFamilyNode || selectedFamilyNode.item_type !== 'FAMILY') {
            setAssignments([]);
            setAssignmentsError('');
            setAssignmentsLoading(false);
            return;
        }
        const controller = new AbortController();
        setAssignmentsLoading(true);
        setAssignmentsError('');
        fetch(
            `${apiBaseUrl}/family-list/${selectedFamilyNode.id}/assignments`,
            { signal: controller.signal }
        )
            .then((response) => {
                if (!response.ok) {
                    return response.json().catch(() => null).then((body) => {
                        const message = body?.detail || body?.message || '할당 데이터를 불러오는 데 실패했습니다.';
                        throw new Error(message);
                    });
                }
                return response.json();
            })
            .then((payload) => {
                if (controller.signal.aborted) return;
                setAssignments(Array.isArray(payload) ? payload.filter(Boolean) : []);
            })
            .catch((error) => {
                if (error.name === 'AbortError') return;
                setAssignmentsError(error.message);
                setAssignments([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setAssignmentsLoading(false);
                }
            });
        return () => {
            controller.abort();
        };
    }, [apiBaseUrl, selectedFamilyNode]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage('업로드할 파일을 선택해주세요.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            setMessage('업로드 중...');
            const response = await fetch(`${apiBaseUrl}/work-masters/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || '업로드 실패');
            
            setMessage(`업로드 성공: 생성 ${data.created}건, 업데이트 ${data.updated}건`);
            fetchWorkMasters(); // 업로드 후 목록을 새로고침합니다.
        } catch (error) {
            setMessage(`업로드 실패: ${error.message}`);
        }
    };

        const standardItemMap = useMemo(() => {
            const map = new Map();
            standardItems.forEach((item) => {
                if (item && Number.isFinite(Number(item.id))) {
                    map.set(Number(item.id), item);
                }
            });
            return map;
        }, [standardItems]);

        const assignmentDetails = useMemo(() => {
            return assignments.map((entry) => {
                const itemId = Number(entry.standard_item_id);
                return {
                    ...entry,
                    standardItem: standardItemMap.get(itemId),
                };
            });
        }, [assignments, standardItemMap]);

        const gwmAssignments = assignmentDetails.filter(
            (assignment) => assignment.standardItem?.type === 'GWM'
        );
        const swmAssignments = assignmentDetails.filter(
            (assignment) => assignment.standardItem?.type === 'SWM'
        );

    const handleSearch = (e) => {
        e.preventDefault();
        fetchWorkMasters(searchTerm);
    };

    const handleRefresh = () => {
        setSearchTerm('');
        fetchWorkMasters();
    };

    const handleNewWorkMasterCellChange = useCallback((key, next) => {
        setNewWorkMasterRow((prev) => ({ ...prev, [key]: next }));
    }, []);

    const handleNewWorkMasterPaste = useCallback((colIndex) => (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!text) return;

        const normalized = text.replace(/\r/g, '');
        const firstLine = normalized.split('\n')[0] ?? '';
        const parts = firstLine.split('\t');
        if (parts.length <= 1) return;

        e.preventDefault();
        setNewWorkMasterRow((prev) => {
            const next = { ...prev };
            for (let i = 0; i < parts.length; i += 1) {
                const idx = colIndex + i;
                if (idx >= WORK_MASTER_CREATE_COLUMNS.length) break;
                const key = WORK_MASTER_CREATE_COLUMNS[idx].key;
                next[key] = (parts[i] ?? '').toString();
            }
            return next;
        });
    }, []);

    const createNewWorkMaster = useCallback(async () => {
        if (!apiBaseUrl) return;
        if (createBusyRef.current) return;
        createBusyRef.current = true;

        try {
            const workMasterCode = (newWorkMasterRow?.work_master_code ?? '').toString().trim();
            if (!workMasterCode) {
                setMessage('work_master_code는 필수입니다.');
                newWorkMasterCodeRef.current?.focus?.();
                return;
            }

            const payload = {};
            WORK_MASTER_CREATE_COLUMNS.forEach((col) => {
                const raw = newWorkMasterRow?.[col.key];
                const value = (raw ?? '').toString();
                if (value.trim() !== '') {
                    payload[col.key] = value;
                }
            });

            setMessage('신규 WorkMaster 생성 중...');
            const response = await fetch(`${apiBaseUrl}/work-masters/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(body?.detail || body?.message || '신규 WorkMaster 생성에 실패했습니다.');
            }

            setMessage(`신규 WorkMaster 생성 완료: ${workMasterCode}`);
            setNewWorkMasterRow(createEmptyNewWorkMasterRow());
            fetchWorkMasters(searchTerm);
            newWorkMasterCodeRef.current?.focus?.();
        } catch (error) {
            setMessage(`신규 WorkMaster 생성 실패: ${error?.message || 'unknown error'}`);
        } finally {
            createBusyRef.current = false;
        }
    }, [apiBaseUrl, newWorkMasterRow, searchTerm]);

    return (
        <div>
            <h2>WorkMaster 관리</h2>
            
            <form
                onSubmit={handleUpload}
                style={{
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                }}
            >
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>엑셀 업로드</div>
                <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".xlsx"
                    style={{ fontSize: 12, flex: '0 1 auto' }}
                />
                <button type="submit" style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                    업로드
                </button>
            </form>

            {message && <p><strong>상태:</strong> {message}</p>}

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    marginBottom: 10,
                }}
            >
                <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>WorkMaster 목록</h3>
                <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                    <input
                        type="text"
                        placeholder="전체 컬럼에서 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '5px', minWidth: 220 }}
                    />
                    <button type="submit" style={{ whiteSpace: 'nowrap' }}>검색</button>
                </form>
                <button type="button" onClick={handleRefresh} style={{ whiteSpace: 'nowrap' }}>새로고침</button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <h3 style={{ margin: 0 }}>신규 WM 추가</h3>
                <button type="button" onClick={createNewWorkMaster}>신규 WM 추가</button>
            </div>
            <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid #ccc' }}>
                <table style={{ width: 'max-content', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f2f2f2' }}>
                        <tr>
                            {WORK_MASTER_CREATE_COLUMNS.map((col) => (
                                <th key={col.key} style={tableHeaderStyle}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {WORK_MASTER_CREATE_COLUMNS.map((col, idx) => (
                                <td key={col.key} style={{ ...tableCellStyle, padding: 4 }}>
                                    <input
                                        ref={col.key === 'work_master_code' ? newWorkMasterCodeRef : undefined}
                                        value={(newWorkMasterRow?.[col.key] ?? '').toString()}
                                        onChange={(e) => handleNewWorkMasterCellChange(col.key, e.target.value)}
                                        onPaste={handleNewWorkMasterPaste(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                createNewWorkMaster();
                                            }
                                        }}
                                        placeholder={col.required ? '(필수)' : ''}
                                        style={{ width: 160, padding: '6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
                                    />
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ccc', marginTop: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f2f2f2' }}>
                        <tr>
                            <th style={tableHeaderStyle}>Work Master Code</th>
                            <th style={tableHeaderStyle}>Discipline</th>
                            <th style={tableHeaderStyle}>Gauge Code</th>
                            <th style={tableHeaderStyle}>Large Category</th>
                            <th style={tableHeaderStyle}>Mid Category</th>
                            <th style={tableHeaderStyle}>Small Category</th>
                            <th style={tableHeaderStyle}>Unit</th>
                            <th style={tableHeaderStyle}>New/Old</th>
                            <th style={tableHeaderStyle}>Attr1 Spec</th>
                            <th style={tableHeaderStyle}>Attr2 Spec</th>
                            <th style={tableHeaderStyle}>Attr3 Spec</th>
                            <th style={tableHeaderStyle}>Attr4 Spec</th>
                            <th style={tableHeaderStyle}>Attr5 Spec</th>
                            <th style={tableHeaderStyle}>Attr6 Spec</th>
                        </tr>
                    </thead>
                    <tbody>
                        {workMasters.map((wm) => (
                            <tr key={wm.id}>
                                <td style={tableCellStyle}>{wm.work_master_code}</td>
                                <td style={tableCellStyle}>{wm.discipline}</td>
                                <td style={tableCellStyle}>{wm.gauge}</td>
                                <td style={tableCellStyle}>{wm.cat_large_desc}</td>
                                <td style={tableCellStyle}>{wm.cat_mid_desc}</td>
                                <td style={tableCellStyle}>{wm.cat_small_desc}</td>
                                <td style={tableCellStyle}>{wm.uom1}</td>
                                <td style={tableCellStyle}>{wm.new_old_code}</td>
                                <td style={tableCellStyle}>{wm.attr1_spec}</td>
                                <td style={tableCellStyle}>{wm.attr2_spec}</td>
                                <td style={tableCellStyle}>{wm.attr3_spec}</td>
                                <td style={tableCellStyle}>{wm.attr4_spec}</td>
                                <td style={tableCellStyle}>{wm.attr5_spec}</td>
                                <td style={tableCellStyle}>{wm.attr6_spec}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const tableHeaderStyle = { padding: '6px 8px', border: '1px solid #ddd', textAlign: 'left', fontSize: 12 };
const tableCellStyle = { padding: '6px 8px', border: '1px solid #ddd', fontSize: 12 };

export default WorkMasterManager;
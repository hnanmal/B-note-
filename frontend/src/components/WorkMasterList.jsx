import React, { useEffect, useState } from 'react';

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export default function WorkMasterList() {
    const [workMasters, setWorkMasters] = useState([]);
    const [selected, setSelected] = useState(null);
    const [message, setMessage] = useState('');

    const fetchWorkMasters = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/work-masters/`);
            if (!res.ok) throw new Error('WorkMaster 목록 조회 실패');
            const data = await res.json();
            setWorkMasters(data);
        } catch (e) {
            setMessage(e.message);
        }
    };

    useEffect(() => { fetchWorkMasters(); }, []);

    return (
        <div>
            <h4>WorkMaster 리스트</h4>
            {message && <div style={{ color: 'red' }}>{message}</div>}
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e6e6e6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 900 }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>코드</th>
                            <th style={thStyle}>Discipline</th>
                            <th style={thStyle}>Large Code</th>
                            <th style={thStyle}>Large Desc</th>
                            <th style={thStyle}>Mid Code</th>
                            <th style={thStyle}>Mid Desc</th>
                            <th style={thStyle}>Small Code</th>
                            <th style={thStyle}>Small Desc</th>
                            <th style={thStyle}>UOM1</th>
                            <th style={thStyle}>UOM2</th>
                            <th style={thStyle}>Attr1 Spec</th>
                            <th style={thStyle}>Attr2 Spec</th>
                            <th style={thStyle}>Attr3 Spec</th>
                            <th style={thStyle}>Work Group</th>
                            <th style={thStyle}>New/Old</th>
                        </tr>
                    </thead>
                    <tbody>
                        {workMasters.map(w => (
                            <tr key={w.id} onClick={() => setSelected(w)} style={w.id === (selected && selected.id) ? selectedRowStyle : { cursor: 'pointer' }}>
                                <td style={tdStyle}>{w.work_master_code}</td>
                                <td style={tdStyle}>{w.discipline}</td>
                                <td style={tdStyle}>{w.cat_large_code}</td>
                                <td style={tdStyle}>{w.cat_large_desc}</td>
                                <td style={tdStyle}>{w.cat_mid_code}</td>
                                <td style={tdStyle}>{w.cat_mid_desc}</td>
                                <td style={tdStyle}>{w.cat_small_code}</td>
                                <td style={tdStyle}>{w.cat_small_desc}</td>
                                <td style={tdStyle}>{w.uom1}</td>
                                <td style={tdStyle}>{w.uom2}</td>
                                <td style={tdStyle}>{w.attr1_spec}</td>
                                <td style={tdStyle}>{w.attr2_spec}</td>
                                <td style={tdStyle}>{w.attr3_spec}</td>
                                <td style={tdStyle}>{w.work_group_code}</td>
                                <td style={tdStyle}>{w.new_old_code}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selected && (
                <div style={{ marginTop: 8, padding: 8, border: '1px solid #eee', background: '#fff' }}>
                    <strong>선택:</strong> {selected.work_master_code} — {selected.cat_large_desc}
                    <div style={{ color: '#666', fontSize: 12 }}>{selected.discipline} · {selected.uom1} · {selected.uom2}</div>
                </div>
            )}
        </div>
    );
}

const thStyle = { textAlign: 'left', padding: '6px', borderBottom: '1px solid #ddd' };
const tdStyle = { padding: '6px', borderBottom: '1px solid #f5f5f5' };
const selectedRowStyle = { background: '#eef6ff', cursor: 'pointer' };

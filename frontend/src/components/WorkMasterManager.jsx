import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';

function WorkMasterManager({ apiBaseUrl = API_BASE_URL }) {
    const [workMasters, setWorkMasters] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');

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

    const handleSearch = (e) => {
        e.preventDefault();
        fetchWorkMasters(searchTerm);
    };

    const handleRefresh = () => {
        setSearchTerm('');
        fetchWorkMasters();
    };

    return (
        <div>
            <h2>WorkMaster 관리</h2>
            
            <form onSubmit={handleUpload} style={{ marginBottom: '20px' }}>
                <h3>엑셀 업로드</h3>
                <input type="file" onChange={handleFileChange} accept=".xlsx" />
                <button type="submit">업로드</button>
            </form>

            {message && <p><strong>상태:</strong> {message}</p>}

            <h3>WorkMaster 목록</h3>
            <div style={{ marginBottom: '10px' }}>
                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        placeholder="전체 컬럼에서 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginRight: '10px', padding: '5px' }}/>
                    <button type="submit">검색</button>
                </form>
            </div>
            <button onClick={handleRefresh}>새로고침</button>
            <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ccc', marginTop: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f2f2f2' }}>
                        <tr>
                            <th style={tableHeaderStyle}>Work Master Code</th>
                            <th style={tableHeaderStyle}>Discipline</th>
                            <th style={tableHeaderStyle}>Large Category</th>
                            <th style={tableHeaderStyle}>Mid Category</th>
                            <th style={tableHeaderStyle}>Small Category</th>
                            <th style={tableHeaderStyle}>Unit</th>
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
                                <td style={tableCellStyle}>{wm.cat_large_desc}</td>
                                <td style={tableCellStyle}>{wm.cat_mid_desc}</td>
                                <td style={tableCellStyle}>{wm.cat_small_desc}</td>
                                <td style={tableCellStyle}>{wm.uom1}</td>
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

const tableHeaderStyle = { padding: '8px', border: '1px solid #ddd', textAlign: 'left' };
const tableCellStyle = { padding: '8px', border: '1px solid #ddd' };

export default WorkMasterManager;
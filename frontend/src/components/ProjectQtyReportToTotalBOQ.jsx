import React, { useEffect, useState } from 'react';

const baseHeaders = [
  'Work Master Code',
  'Gauge Code',
  'Description',
  'Spec.',
  'Additional Spec.',
  'Reference to',
  'UoM',
  'Total',
];

export default function ProjectQtyReportToTotalBOQ({ apiBaseUrl }) {
  const [buildingNames, setBuildingNames] = useState([]);
  const [revKeys, setRevKeys] = useState([]);
  const [selectedRevKey, setSelectedRevKey] = useState('');

  useEffect(() => {
    if (!apiBaseUrl) return;
    // building names (existing behavior)
    fetch(`${apiBaseUrl}/calc-result/buildings`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const seen = new Set();
          const ordered = data.filter(b => {
            if (!b || seen.has(b)) return false;
            seen.add(b);
            return true;
          });
          setBuildingNames(ordered);
        }
      })
      .catch(() => {});

    // fetch rev keys for dropdown (safe, non-blocking)
    fetch(`${apiBaseUrl}/calc-result/rev-keys`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRevKeys(data);
      })
      .catch(() => {});
  }, [apiBaseUrl]);

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#d97706' }}>
          Q'ty Report to Total BOQ
        </div>
        <div>
          <select
            value={selectedRevKey}
            onChange={e => setSelectedRevKey(e.target.value)}
            style={{ height: 32, fontSize: 15, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 140 }}
          >
            <option value="">rev 선택</option>
            {revKeys.map((rev) => (
              <option key={rev} value={rev}>{rev}</option>
            ))}
          </select>
        </div>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f7c748', color: '#2c1b00' }}>
            {baseHeaders.map((h) => (
              <th key={h} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
            ))}
            {buildingNames.map((b) => (
              <th key={b} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* 실제 데이터 렌더링 필요 */}
          <tr>
            <td colSpan={baseHeaders.length + buildingNames.length} style={{ textAlign: 'center', color: '#bbb', padding: 32 }}>
              (준비중) DB 연동 후 워크마스터/게이지코드별 집계표가 표시됩니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

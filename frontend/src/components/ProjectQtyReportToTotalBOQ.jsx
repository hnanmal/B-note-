import React from 'react';

// TODO: 실제 데이터 fetch/연결 필요
const mockHeaders = [
  'Work Master Code',
  'Gauge Code',
  'Description',
  'Spec.',
  'Additional Spec.',
  'Reference to',
  'UoM',
  'Total',
  // 건물별 칼럼은 동적으로 추가 예정
];

export default function ProjectQtyReportToTotalBOQ() {
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#d97706' }}>
        Q'ty Report to Total BOQ
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f7c748', color: '#2c1b00' }}>
            {mockHeaders.map((h) => (
              <th key={h} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
            ))}
            {/* 건물별 칼럼 예시 */}
            <th style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>TRUCK LOADING GATE HOUSE</th>
            <th style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>OS_1</th>
            <th style={{ padding: '8px 6px', border: '1px solid #e5e7eb', fontWeight: 700 }}>SS9</th>
          </tr>
        </thead>
        <tbody>
          {/* 실제 데이터 렌더링 필요 */}
          <tr>
            <td colSpan={mockHeaders.length + 3} style={{ textAlign: 'center', color: '#bbb', padding: 32 }}>
              (준비중) DB 연동 후 워크마스터/게이지코드별 집계표가 표시됩니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

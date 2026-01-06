import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const handleResponse = async (response) => {
  if (response.ok) return response.json();
  const payload = await response.json().catch(() => null);
  const message = payload?.detail || payload?.message || '요청 처리 중 오류가 발생했습니다.';
  throw new Error(message);
};

const SummaryRow = React.memo(function SummaryRow({
  row,
  index,
  getWorkMasterDetailParts,
  shouldBoldWorkMasterLabel,
  isEditingSpec,
  isSaving,
  editingWorkMasterId,
  editingSpecSeed,
  specTextareaRef,
  insertNewlineAtCaret,
  onStartSpecEdit,
  onSaveSpecEdit,
  onCancelSpecEdit,
  rowRefs,
}) {
  const wmCode = row?.work_master_code ?? '';
  const gauge = row?.gauge ?? '';
  const unit = row?.uom1 ?? '';
  const spec = row?.add_spec ?? '';
  const detailParts = getWorkMasterDetailParts(row);
  const type = `${row?.standard_item_type ?? ''}`;
  const itemPath = row?.standard_item_path ?? '';

  return (
    <div
      ref={(node) => {
        const key = row?.work_master_id;
        if (!key) return;
        if (node) rowRefs.current.set(key, node);
        else rowRefs.current.delete(key);
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 160px 64px 70px 240px 1fr 200px 1fr',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 11,
        color: '#0f172a',
      }}
    >
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{index + 1}</div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', fontWeight: 700 }}>{wmCode}</div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{gauge}</div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{unit}</div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
        {isEditingSpec ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <textarea
              ref={specTextareaRef}
              key={editingWorkMasterId}
              defaultValue={editingSpecSeed}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if (event.altKey) {
                  event.preventDefault();
                  const target = event.target;
                  if (target instanceof HTMLTextAreaElement) insertNewlineAtCaret(target);
                  return;
                }
                event.preventDefault();
                onSaveSpecEdit();
              }}
              rows={3}
              style={{
                flex: 1,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 11,
                minWidth: 0,
                resize: 'vertical',
                lineHeight: 1.35,
              }}
            />
            <button
              type="button"
              onClick={onSaveSpecEdit}
              disabled={isSaving}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: isSaving ? '#93c5fd' : '#2563eb',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={onCancelSpecEdit}
              disabled={isSaving}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5f5',
                background: '#fff',
                color: '#1d4ed8',
                fontSize: 11,
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStartSpecEdit(row)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: '2px 0',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 11,
              color: '#0f172a',
              display: 'block',
              minHeight: 16,
            }}
            title="Spec 수정"
          >
            {spec ? spec : <span style={{ color: '#94a3b8' }}>클릭하여 입력</span>}
          </button>
        )}
      </div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <span>{wmCode}</span>
        {gauge ? <span>{` | ${gauge}`}</span> : null}
        {detailParts.length > 0 ? <span>{' | '}</span> : null}
        {detailParts.map((part, i) => (
          <span key={`${part.label}-${i}`}>
            {i > 0 ? ' | ' : ''}
            <span>{part.label}=</span>
            <span
              style={shouldBoldWorkMasterLabel(part.label)
                ? { fontWeight: 900, color: '#9333ea', fontSize: 12 }
                : { fontWeight: 400 }}
            >
              {part.value}
            </span>
          </span>
        ))}
      </div>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{type}</div>
      <div style={{ padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{itemPath}</div>
    </div>
  );
});

export default function ProjectWmSummary({ apiBaseUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sortState, setSortState] = useState({ key: null, direction: null });
  const [sortMenu, setSortMenu] = useState({ open: false, key: null, x: 0, y: 0 });
  const [editingWorkMasterId, setEditingWorkMasterId] = useState(null);
  const [editingSpecSeed, setEditingSpecSeed] = useState('');
  const [savingWorkMasterId, setSavingWorkMasterId] = useState(null);
  const scrollContainerRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingRestoreRef = useRef(null);
  const specTextareaRef = useRef(null);
  const sortMenuRef = useRef(null);

  const insertNewlineAtCaret = useCallback((target) => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.value = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
    requestAnimationFrame(() => {
      try {
        target.selectionStart = start + 1;
        target.selectionEnd = start + 1;
      } catch {
        // ignore
      }
    });
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!apiBaseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetch(`${apiBaseUrl}/work-master-selections/summary`).then(handleResponse);
      const resultRows = Array.isArray(data?.rows) ? data.rows : [];
      setRows(resultRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WM Summary를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    if (loading) return;

    pendingRestoreRef.current = null;
    const container = scrollContainerRef.current;
    if (!container) return;

    const restore = () => {
      if (pending?.workMasterId != null) {
        const node = rowRefs.current.get(pending.workMasterId);
        if (node && node.scrollIntoView) {
          node.scrollIntoView({ block: 'center' });
          return;
        }
      }
      if (typeof pending?.scrollTop === 'number') {
        container.scrollTop = pending.scrollTop;
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [loading, rows]);

  const startSpecEdit = useCallback((row) => {
    const wmId = row?.work_master_id ?? null;
    if (!wmId) return;
    setEditingWorkMasterId(wmId);
    setEditingSpecSeed((row?.add_spec ?? '').toString());
  }, []);

  useEffect(() => {
    if (editingWorkMasterId == null) return;
    if (savingWorkMasterId != null) return;
    const node = specTextareaRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        node.focus();
        const len = node.value?.length ?? 0;
        node.selectionStart = len;
        node.selectionEnd = len;
      } catch {
        // ignore
      }
    });
  }, [editingWorkMasterId, savingWorkMasterId]);

  useEffect(() => {
    if (!sortMenu.open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setSortMenu({ open: false, key: null, x: 0, y: 0 });
      }
    };
    const handlePointer = (event) => {
      const node = sortMenuRef.current;
      if (!node) return;
      if (node.contains(event.target)) return;
      setSortMenu({ open: false, key: null, x: 0, y: 0 });
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handlePointer);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handlePointer);
    };
  }, [sortMenu.open]);

  const cancelSpecEdit = useCallback(() => {
    setEditingWorkMasterId(null);
    setEditingSpecSeed('');
  }, []);

  const saveSpecEdit = useCallback(async () => {
    if (!apiBaseUrl || !editingWorkMasterId) return;
    const nextSpec = (specTextareaRef.current?.value ?? editingSpecSeed).toString();
    const container = scrollContainerRef.current;
    pendingRestoreRef.current = {
      scrollTop: container ? container.scrollTop : 0,
      workMasterId: editingWorkMasterId,
    };
    setSavingWorkMasterId(editingWorkMasterId);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/work-masters/${editingWorkMasterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_spec: nextSpec }),
      }).then(handleResponse);
      setEditingWorkMasterId(null);
      setEditingSpecSeed('');
      setRows((prev) => prev.map((row) => (
        row?.work_master_id === editingWorkMasterId
          ? { ...row, add_spec: nextSpec }
          : row
      )));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spec을 저장하지 못했습니다.';
      setError(message);
    } finally {
      setSavingWorkMasterId(null);
    }
  }, [apiBaseUrl, editingSpecSeed, editingWorkMasterId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const groupedRows = useMemo(() => {
    const groups = new Map();

    const normalizeKeyPart = (value) => (value ?? '').toString().trim();
    const addToSet = (set, value) => {
      const v = (value ?? '').toString().trim();
      if (!v) return;
      set.add(v);
    };

    rows.forEach((row) => {
      const wmCode = normalizeKeyPart(row?.work_master_code);
      const gauge = normalizeKeyPart(row?.gauge);
      const key = `${wmCode}||${gauge}`;

      const type = row?.standard_item_type;
      const path = row?.standard_item_path;
      const name = row?.standard_item_name;

      if (!groups.has(key)) {
        groups.set(key, {
          row: { ...row },
          types: new Set(),
          paths: new Set(),
          names: new Set(),
        });
      }

      const entry = groups.get(key);
      addToSet(entry.types, type);
      addToSet(entry.paths, path);
      addToSet(entry.names, name);
    });

    return Array.from(groups.values()).map(({ row, types, paths, names }) => {
      const mergedTypes = Array.from(types).join(', ');
      const mergedPaths = Array.from(paths).join(', ');
      const mergedNames = Array.from(names).join(', ');

      return {
        ...row,
        standard_item_type: mergedTypes || (row?.standard_item_type ?? ''),
        standard_item_path: mergedPaths || (row?.standard_item_path ?? ''),
        _standard_item_names_joined: mergedNames,
      };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedRows;
    return groupedRows.filter((row) => {
      const tokens = [
        row?.work_master_code,
        row?.gauge,
        row?.uom1,
        row?.add_spec,
        row?.standard_item_name,
        row?._standard_item_names_joined,
        row?.standard_item_type,
        row?.standard_item_path,
      ]
        .map((v) => (v ?? '').toString().toLowerCase())
        .join(' | ');
      return tokens.includes(q);
    });
  }, [groupedRows, query]);

  const getWorkMasterDetailParts = useCallback((row) => {
    const parts = [];
    const add = (label, value) => {
      const v = (value ?? '').toString().trim();
      if (!v) return;
      parts.push({ label, value: v });
    };

    add('Discipline', row?.discipline);
    add('Large', [row?.cat_large_code, row?.cat_large_desc].filter(Boolean).join(' '));
    add('Mid', [row?.cat_mid_code, row?.cat_mid_desc].filter(Boolean).join(' '));
    add('Small', [row?.cat_small_code, row?.cat_small_desc].filter(Boolean).join(' '));
    add('Attr1', [row?.attr1_code, row?.attr1_spec].filter(Boolean).join(' '));
    add('Attr2', [row?.attr2_code, row?.attr2_spec].filter(Boolean).join(' '));
    add('Attr3', [row?.attr3_code, row?.attr3_spec].filter(Boolean).join(' '));
    add('Attr4', [row?.attr4_code, row?.attr4_spec].filter(Boolean).join(' '));
    add('Attr5', [row?.attr5_code, row?.attr5_spec].filter(Boolean).join(' '));
    add('Attr6', [row?.attr6_code, row?.attr6_spec].filter(Boolean).join(' '));
    add('UOM1', row?.uom1);
    add('UOM2', row?.uom2);
    add('Group', row?.work_group_code);
    add('New/Old', row?.new_old_code);

    return parts;
  }, []);

  const formatWorkMasterDetails = useCallback((row) => {
    return getWorkMasterDetailParts(row)
      .map((part) => `${part.label}=${part.value}`)
      .join(' | ');
  }, [getWorkMasterDetailParts]);

  const shouldBoldWorkMasterLabel = useCallback((label) => {
    return label === 'Mid' || label === 'Small' || label === 'Attr1' || label === 'Attr2';
  }, []);

  const sortedRows = useMemo(() => {
    const { key, direction } = sortState || {};
    if (!key || !direction) return filteredRows;

    const dir = direction === 'desc' ? -1 : 1;
    const normalize = (v) => (v ?? '').toString().trim();
    const normalizeLower = (v) => normalize(v).toLowerCase();
    const cmpStr = (a, b) => normalizeLower(a).localeCompare(normalizeLower(b), 'en', { numeric: true, sensitivity: 'base' });
    const cmpMaybeNumber = (a, b) => {
      const na = Number(a);
      const nb = Number(b);
      const aIsNum = Number.isFinite(na) && normalize(a) !== '';
      const bIsNum = Number.isFinite(nb) && normalize(b) !== '';
      if (aIsNum && bIsNum) return na - nb;
      return cmpStr(a, b);
    };

    const getVal = (row) => {
      switch (key) {
        case 'no':
          return row?._rowIndex ?? 0;
        case 'work_master_code':
          return row?.work_master_code;
        case 'gauge':
          return row?.gauge;
        case 'uom1':
          return row?.uom1;
        case 'add_spec':
          return row?.add_spec;
        case 'work_master':
          return `${row?.work_master_code ?? ''} ${row?.gauge ?? ''} ${formatWorkMasterDetails(row)}`;
        case 'standard_item_type':
          return row?.standard_item_type;
        case 'standard_item_path':
          return row?.standard_item_path;
        default:
          return '';
      }
    };

    const indexed = filteredRows.map((r, idx) => ({ ...r, _rowIndex: idx + 1 }));
    indexed.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);

      let c = 0;
      if (key === 'no') c = cmpMaybeNumber(av, bv);
      else c = cmpStr(av, bv);

      if (c !== 0) return c * dir;
      return (a._rowIndex - b._rowIndex) * dir;
    });
    return indexed;
  }, [filteredRows, formatWorkMasterDetails, sortState]);

  const exportToExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const headers = ['No', 'WM Code', 'Gauge', 'Unit', 'Spec', 'Work Master', 'Type', 'Item Path'];
      const aoa = [headers];

      sortedRows.forEach((row, idx) => {
        const wmCode = row?.work_master_code ?? '';
        const gauge = row?.gauge ?? '';
        const unit = row?.uom1 ?? '';
        const spec = row?.add_spec ?? '';
        const workMasterText = `${wmCode}${gauge ? ` | ${gauge}` : ''}${formatWorkMasterDetails(row) ? ` | ${formatWorkMasterDetails(row)}` : ''}`;
        const type = `${row?.standard_item_type ?? ''}`;
        const itemPath = row?.standard_item_path ?? '';

        aoa.push([idx + 1, wmCode, gauge, unit, spec, workMasterText, type, itemPath]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 34 },
        { wch: 90 },
        { wch: 18 },
        { wch: 80 },
      ];
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'WM Summary');

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `WM_Summary_${stamp}.xlsx`;

      XLSX.writeFile(wb, filename, { compression: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '엑셀 파일 생성 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setExporting(false);
    }
  }, [exporting, formatWorkMasterDetails, sortedRows]);

  const openSortMenu = useCallback((event, key) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setSortMenu({ open: true, key, x: rect.left, y: rect.bottom + 6 });
  }, []);

  const applySort = useCallback((key, direction) => {
    setSortState({ key, direction });
    setSortMenu({ open: false, key: null, x: 0, y: 0 });
  }, []);

  const clearSort = useCallback(() => {
    setSortState({ key: null, direction: null });
    setSortMenu({ open: false, key: null, x: 0, y: 0 });
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>WM Summary Sheet</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            프로젝트 DB의 <code>standard_item_work_master_select</code> 선택 결과를 표시합니다.
          </div>
          {apiBaseUrl ? <div style={{ fontSize: 11, color: '#94a3b8' }}>API: {apiBaseUrl}</div> : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 (코드/Spec/경로 등)"
            style={{
              height: 34,
              borderRadius: 10,
              border: '1px solid #d1d5db',
              padding: '0 12px',
              fontSize: 12,
              minWidth: 240,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={exportToExcel}
            disabled={loading || exporting || sortedRows.length === 0}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid #0ea5e9',
              background: loading || exporting || sortedRows.length === 0 ? '#bae6fd' : '#0ea5e9',
              color: '#083344',
              fontWeight: 800,
              cursor: loading || exporting || sortedRows.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
            title="현재 화면(검색 필터 적용 결과)을 엑셀로 저장"
          >
            {exporting ? '엑셀 생성 중...' : '엑셀(.xlsx)'}
          </button>
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid #2563eb',
              background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: '#fff',
          borderRadius: 16,
          padding: 12,
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {error ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div> : null}

        <div style={{ fontSize: 12, color: '#475569' }}>
          총 <b>{sortedRows.length}</b>건
          {sortState?.key && sortState?.direction ? (
            <span style={{ marginLeft: 8, color: '#64748b' }}>
              (정렬: {sortState.key} {sortState.direction === 'asc' ? '▲' : '▼'})
            </span>
          ) : null}
        </div>

        <div ref={scrollContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 160px 64px 70px 240px 1fr 200px 1fr',
              gap: 0,
              position: 'sticky',
              top: 0,
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              zIndex: 1,
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            {[
              { label: 'No', key: 'no' },
              { label: 'WM Code', key: 'work_master_code' },
              { label: 'Gauge', key: 'gauge' },
              { label: 'Unit', key: 'uom1' },
              { label: 'Spec', key: 'add_spec' },
              { label: 'Work Master', key: 'work_master' },
              { label: 'Type', key: 'standard_item_type' },
              { label: 'Item Path', key: 'standard_item_path' },
            ].map((col) => {
              const active = sortState?.key === col.key;
              const arrow = active ? (sortState.direction === 'asc' ? ' ▲' : sortState.direction === 'desc' ? ' ▼' : '') : '';
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={(e) => openSortMenu(e, col.key)}
                  style={{
                    padding: '8px 10px',
                    borderRight: '1px solid #e5e7eb',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="정렬 옵션"
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}{arrow}</span>
                  <span style={{ color: '#94a3b8' }}>▾</span>
                </button>
              );
            })}
          </div>

          {sortMenu.open ? (
            <div
              ref={sortMenuRef}
              style={{
                position: 'fixed',
                top: sortMenu.y,
                left: sortMenu.x,
                zIndex: 50,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
                padding: 6,
                width: 180,
                fontSize: 12,
              }}
            >
              <div style={{ padding: '6px 8px', color: '#0f172a', fontWeight: 800 }}>정렬</div>
              <button
                type="button"
                onClick={() => applySort(sortMenu.key, 'asc')}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 4,
                }}
              >
                오름차순 (A→Z)
              </button>
              <button
                type="button"
                onClick={() => applySort(sortMenu.key, 'desc')}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 6,
                }}
              >
                내림차순 (Z→A)
              </button>
              <button
                type="button"
                onClick={clearSort}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#334155',
                }}
              >
                정렬 해제
              </button>
            </div>
          ) : null}

          {loading ? (
            <div style={{ padding: 14, fontSize: 12, color: '#475467' }}>데이터를 불러오는 중입니다...</div>
          ) : sortedRows.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: '#475467' }}>표시할 데이터가 없습니다.</div>
          ) : (
            sortedRows.map((row, idx) => {
              const isEditingSpec = editingWorkMasterId != null && row?.work_master_id === editingWorkMasterId;
              const isSaving = savingWorkMasterId === editingWorkMasterId;
              return (
                <SummaryRow
                  key={`${row?.standard_item_id ?? 'std'}-${row?.work_master_id ?? 'wm'}-${idx}`}
                  row={row}
                  index={idx}
                  getWorkMasterDetailParts={getWorkMasterDetailParts}
                  shouldBoldWorkMasterLabel={shouldBoldWorkMasterLabel}
                  isEditingSpec={isEditingSpec}
                  isSaving={isSaving}
                  editingWorkMasterId={editingWorkMasterId}
                  editingSpecSeed={editingSpecSeed}
                  specTextareaRef={specTextareaRef}
                  insertNewlineAtCaret={insertNewlineAtCaret}
                  onStartSpecEdit={startSpecEdit}
                  onSaveSpecEdit={saveSpecEdit}
                  onCancelSpecEdit={cancelSpecEdit}
                  rowRefs={rowRefs}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

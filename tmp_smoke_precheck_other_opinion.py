"""Smoke test: work_master_precheck.other_opinion end-to-end.

Usage:
  python tmp_smoke_precheck_other_opinion.py <project_identifier>

What it checks:
- `work_master_precheck` has `other_opinion` column
- PATCH handler upserts `other_opinion` via `/work-masters/{id}/precheck` logic
- Excel export includes the UI column header for `other_opinion` in `Report_WM`

Note: On some Windows terminals, Korean characters may display garbled due to
codepage/encoding. This script prints Unicode codepoints as a reliable check.
"""

from __future__ import annotations

import asyncio
import io
import sqlite3
import sys
from pathlib import Path

import openpyxl

from backend import project_db, schemas
from backend.api import (
    export_project_db_excel,
    get_project_db_session,
    update_project_work_master_precheck_state,
)


def _consume_streaming_response(resp) -> bytes:
    async def _consume(r):
        chunks = []
        async for c in r.body_iterator:
            chunks.append(c)
        return b"".join(chunks)

    return asyncio.run(_consume(resp))


def main(project_identifier: str) -> int:
    db_path = project_db.resolve_project_db_path(project_identifier)
    project_db.ensure_extra_tables(db_path)

    conn = sqlite3.connect(db_path.as_posix())
    try:
        cols = [
            c[1]
            for c in conn.execute(
                "PRAGMA table_info('work_master_precheck')"
            ).fetchall()
        ]
        if "other_opinion" not in cols:
            raise RuntimeError("work_master_precheck.other_opinion column missing")

        wm_row = conn.execute(
            "SELECT id FROM work_masters ORDER BY id LIMIT 1"
        ).fetchone()
        if not wm_row:
            raise RuntimeError("no work_masters rows found")
        work_master_id = int(wm_row[0])

        # Start clean for this WM
        conn.execute(
            "DELETE FROM work_master_precheck WHERE work_master_id=?", (work_master_id,)
        )
        conn.commit()
    finally:
        conn.close()

    # Use the same handler used by the API route.
    db = next(get_project_db_session(project_identifier))
    try:
        updated = update_project_work_master_precheck_state(
            project_identifier,
            work_master_id,
            schemas.WorkMasterPrecheckUpdate(other_opinion="hello"),
            db=db,
        )
        print("patched:", updated)
    finally:
        db.close()

    # Verify DB
    conn = sqlite3.connect(db_path.as_posix())
    try:
        row = conn.execute(
            "SELECT use_yn, other_opinion FROM work_master_precheck WHERE work_master_id=?",
            (work_master_id,),
        ).fetchone()
        print("db row:", row)
    finally:
        conn.close()

    # Verify Excel headers
    resp = export_project_db_excel(project_identifier)
    xlsx_bytes = _consume_streaming_response(resp)
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=False)
    ws = wb["Report_WM"]
    headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]

    # Print first 7 UI columns with codepoints for reliable verification.
    ui_headers = headers[:7]
    print("ui headers (repr):", [repr(h) for h in ui_headers])
    print(
        "ui headers (codepoints):",
        [[hex(ord(ch)) for ch in (h or "")] for h in ui_headers],
    )

    if "기타의견" not in headers:
        raise RuntimeError("Report_WM is missing header: 기타의견")

    print("OK")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {Path(__file__).name} <project_identifier>")
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))

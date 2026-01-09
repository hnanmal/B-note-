import json
import re
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

PROJECT_DIR = Path(__file__).resolve().parent
PROJECT_DB_DIR = PROJECT_DIR / "pjt_db"
PROJECT_DB_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST_PATH = PROJECT_DB_DIR / "project_db_manifest.json"
TEMPLATE_DB = PROJECT_DIR / "b-note-dev.db"
ADMIN_KEY = "HECBIM"
BACKUP_DIR = PROJECT_DB_DIR / "backup"

FILENAME_PATTERN = re.compile(r'^[^<>:"/\\|\?\*\x00-\x1F]+\.db$', re.IGNORECASE)
EXTRA_TABLE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS project_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        pjt_abbr TEXT,
        pjt_description TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS project_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user TEXT,
        occurred_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS building_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS family_revit_type (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_list_id INTEGER NOT NULL,
        type_name TEXT NOT NULL,
        building_name TEXT,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS standard_item_work_master_select (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        standard_item_id INTEGER NOT NULL UNIQUE,
        work_master_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS workmaster_cart_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS work_master_precheck (
        work_master_id INTEGER PRIMARY KEY,
        use_yn INTEGER NOT NULL DEFAULT 1,
        other_opinion TEXT,
        updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS calc_result (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        rev_key TEXT,
        building_name TEXT,
        guid TEXT,
        gui TEXT,
        member_name TEXT,
        category TEXT,
        standard_type_number TEXT,
        standard_type_name TEXT,
        classification TEXT,
        detail_classification TEXT,
        unit TEXT,
        formula TEXT,
        substituted_formula TEXT,
        result REAL,
        result_log TEXT,
        work_master_id INTEGER,
        work_master_code TEXT,
        created_at TEXT NOT NULL
    )
    """,
]


def _read_manifest() -> Dict[str, Dict[str, str]]:
    if not MANIFEST_PATH.exists():
        return {}
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_manifest(data: Dict[str, Dict[str, str]]) -> None:
    MANIFEST_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _next_available_path(
    display_name: str, *, allow_same: Optional[str] = None
) -> Path:
    base = _sanitize_display_name_for_filename(display_name)
    candidate = PROJECT_DB_DIR / f"{base}.db"
    if allow_same and candidate.name == allow_same:
        return candidate
    counter = 1
    while candidate.exists():
        candidate = PROJECT_DB_DIR / f"{base}_{counter}.db"
        counter += 1
    return candidate


def _verify_filename(file_name: str) -> None:
    if not FILENAME_PATTERN.match(file_name):
        raise ValueError("파일 이름이 유효하지 않습니다.")


def _resolve_path(file_name: str) -> Path:
    _verify_filename(file_name)
    candidate = PROJECT_DB_DIR / file_name
    if not candidate.exists():
        raise FileNotFoundError("요청하신 프로젝트 DB를 찾을 수 없습니다.")
    resolved = candidate.resolve()
    if resolved.parent != PROJECT_DB_DIR.resolve():
        raise ValueError("잘못된 경로입니다.")
    return resolved


def _resolve_any_filename(file_name: str) -> Path:
    if not file_name or file_name in {".", ".."}:
        raise ValueError("잘못된 경로입니다.")
    # Prevent path traversal / absolute paths.
    if "/" in file_name or "\\" in file_name:
        raise ValueError("잘못된 경로입니다.")
    if _WINDOWS_INVALID_FILENAME_CHARS.search(file_name):
        raise ValueError("파일 이름이 유효하지 않습니다.")
    candidate = PROJECT_DB_DIR / file_name
    if not candidate.exists():
        raise FileNotFoundError("요청하신 프로젝트 DB를 찾을 수 없습니다.")
    resolved = candidate.resolve()
    if resolved.parent != PROJECT_DB_DIR.resolve():
        raise ValueError("잘못된 경로입니다.")
    if not resolved.is_file():
        raise FileNotFoundError("요청하신 프로젝트 DB를 찾을 수 없습니다.")
    return resolved


def _looks_like_sqlite_db(path: Path) -> bool:
    try:
        with path.open("rb") as fp:
            header = fp.read(16)
        return header.startswith(b"SQLite format 3\x00")
    except OSError:
        return False


def resolve_project_db_path(identifier: str) -> Path:
    # Historical behavior: accept both "foo" (routes) and "foo.db" (file name).
    if identifier.endswith(".db"):
        return _resolve_path(identifier)
    try:
        return _resolve_path(f"{identifier}.db")
    except FileNotFoundError:
        # Be robust to accidental extension removal (Windows Explorer often hides extensions).
        resolved = _resolve_any_filename(identifier)
        if not _looks_like_sqlite_db(resolved):
            raise FileNotFoundError("요청하신 프로젝트 DB를 찾을 수 없습니다.")
        return resolved


def _register_entry(
    file_name: str, display_name: str, created_at: Optional[str] = None
) -> None:
    manifest = _read_manifest()
    manifest[file_name] = {
        "display_name": display_name,
        "created_at": created_at or datetime.utcnow().isoformat(),
    }
    _write_manifest(manifest)


def _remove_entry(file_name: str) -> None:
    manifest = _read_manifest()
    if file_name in manifest:
        manifest.pop(file_name)
        _write_manifest(manifest)


def _metadata_for(file_name: str) -> Dict[str, str]:
    manifest = _read_manifest()
    return manifest.get(file_name, {})


def _entry_from_path(file_name: str, metadata: Dict[str, str]) -> Dict[str, str]:
    path = PROJECT_DB_DIR / file_name
    created_at = (
        metadata.get("created_at")
        or datetime.utcfromtimestamp(path.stat().st_ctime).isoformat()
    )
    return {
        "file_name": file_name,
        "display_name": metadata.get("display_name", path.stem),
        "created_at": created_at,
        "size": path.stat().st_size,
    }


def list_project_dbs() -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    manifest = _read_manifest()
    candidates: List[Path] = []
    for child in PROJECT_DB_DIR.iterdir():
        if not child.is_file():
            continue
        if child.name == MANIFEST_PATH.name:
            continue
        if child.suffix.lower() == ".db":
            candidates.append(child)
            continue
        # Include extensionless SQLite DB files (accidental rename can drop ".db").
        if child.suffix == "" and _looks_like_sqlite_db(child):
            candidates.append(child)

    for file_path in sorted(candidates, key=lambda p: p.name.lower()):
        metadata = manifest.get(file_path.name, {})
        items.append(_entry_from_path(file_path.name, metadata))
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items


def _resolve_backup_path(file_name: str) -> Path:
    _verify_filename(file_name)
    candidate = BACKUP_DIR / file_name
    if not candidate.exists():
        raise FileNotFoundError("요청하신 백업 DB를 찾을 수 없습니다.")
    resolved = candidate.resolve()
    if resolved.parent != BACKUP_DIR.resolve():
        raise ValueError("잘못된 경로입니다.")
    if not resolved.is_file():
        raise FileNotFoundError("요청하신 백업 DB를 찾을 수 없습니다.")
    if not _looks_like_sqlite_db(resolved):
        raise ValueError("백업 DB 파일이 손상되었거나 형식이 올바르지 않습니다.")
    return resolved


_BACKUP_NAME_PATTERN = re.compile(r"^(?P<name>.+?)_(?P<ts>\d{8}_\d{6})(?:_\d+)?$")


def _display_name_from_backup_filename(file_name: str) -> str:
    stem = Path(file_name).stem
    match = _BACKUP_NAME_PATTERN.match(stem)
    if match:
        return match.group("name")
    return stem


def list_project_db_backups() -> List[Dict[str, str]]:
    if not BACKUP_DIR.exists():
        return []

    items: List[Dict[str, str]] = []
    for file_path in sorted(BACKUP_DIR.glob("*.db"), key=lambda p: p.name.lower()):
        if not file_path.is_file():
            continue
        if not _looks_like_sqlite_db(file_path):
            continue
        created_at = datetime.utcfromtimestamp(file_path.stat().st_ctime).isoformat()
        items.append(
            {
                "file_name": file_path.name,
                "display_name": _display_name_from_backup_filename(file_path.name),
                "created_at": created_at,
                "size": file_path.stat().st_size,
            }
        )

    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items


def promote_backup_to_project_db(backup_file_name: str) -> Dict[str, str]:
    """Move a backup DB from pjt_db/backup into pjt_db and register it in manifest."""

    backup_path = _resolve_backup_path(backup_file_name)
    display_name = _display_name_from_backup_filename(backup_file_name)

    target_path = _next_available_path(display_name)
    # Move file first (atomic on same volume) then ensure extra tables + register.
    backup_path.rename(target_path)
    ensure_extra_tables(target_path)
    _register_entry(target_path.name, display_name)
    return _entry_from_path(target_path.name, _metadata_for(target_path.name))


def ensure_extra_tables(db_path: Path) -> None:
    conn = sqlite3.connect(db_path.as_posix())
    try:
        cursor = conn.cursor()
        for stmt in EXTRA_TABLE_STATEMENTS:
            cursor.execute(stmt)

        cursor.execute("PRAGMA table_info(calc_result)")
        calc_result_columns = {row[1] for row in cursor.fetchall()}
        if "rev_key" not in calc_result_columns:
            cursor.execute("ALTER TABLE calc_result ADD COLUMN rev_key TEXT")

        cursor.execute("PRAGMA table_info(family_revit_type)")
        frt_columns = {row[1] for row in cursor.fetchall()}
        if "building_name" not in frt_columns:
            cursor.execute(
                "ALTER TABLE family_revit_type ADD COLUMN building_name TEXT"
            )

        cursor.execute("PRAGMA table_info(work_master_precheck)")
        wmp_columns = {row[1] for row in cursor.fetchall()}
        if "other_opinion" not in wmp_columns:
            cursor.execute(
                "ALTER TABLE work_master_precheck ADD COLUMN other_opinion TEXT"
            )

        cursor.execute("PRAGMA table_info(work_masters)")
        wm_columns = {row[1] for row in cursor.fetchall()}
        if "add_spec" not in wm_columns:
            cursor.execute("ALTER TABLE work_masters ADD COLUMN add_spec TEXT")
        if "gauge" not in wm_columns:
            cursor.execute("ALTER TABLE work_masters ADD COLUMN gauge TEXT")
        cursor.execute("PRAGMA table_info(project_metadata)")
        meta_columns = {row[1] for row in cursor.fetchall()}
        if "pjt_abbr" not in meta_columns:
            cursor.execute("ALTER TABLE project_metadata ADD COLUMN pjt_abbr TEXT")
        if "pjt_description" not in meta_columns:
            cursor.execute(
                "ALTER TABLE project_metadata ADD COLUMN pjt_description TEXT"
            )
        cursor.execute("PRAGMA table_info(standard_items)")
        std_columns = {row[1] for row in cursor.fetchall()}
        if "derive_from" not in std_columns:
            cursor.execute("ALTER TABLE standard_items ADD COLUMN derive_from INTEGER")
        cursor.execute("PRAGMA index_list('work_masters')")
        indexes = {row[1] for row in cursor.fetchall()}
        if "ix_work_masters_work_master_code" in indexes:
            cursor.execute("DROP INDEX IF EXISTS ix_work_masters_work_master_code")

        # calc_dictionary migrations
        cursor.execute("PRAGMA table_info(calc_dictionary)")
        calc_cols = cursor.fetchall()
        if calc_cols:
            col_names = {row[1] for row in calc_cols}
            notnull_by_name = {row[1]: row[3] for row in calc_cols}
            if "is_deleted" not in col_names:
                cursor.execute(
                    "ALTER TABLE calc_dictionary ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"
                )
                col_names.add("is_deleted")

            family_notnull = int(notnull_by_name.get("family_list_id", 0) or 0)
            if family_notnull == 1:
                cursor.execute(
                    "ALTER TABLE calc_dictionary RENAME TO calc_dictionary_old"
                )
                cursor.execute(
                    """
                    CREATE TABLE calc_dictionary (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        family_list_id INTEGER,
                        calc_code TEXT,
                        symbol_key TEXT NOT NULL,
                        symbol_value TEXT NOT NULL,
                        is_deleted INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY(family_list_id) REFERENCES family_list(id)
                    )
                    """
                )
                cursor.execute("PRAGMA table_info(calc_dictionary_old)")
                old_cols = cursor.fetchall()
                old_names = {row[1] for row in old_cols}
                calc_code_expr = "calc_code" if "calc_code" in old_names else "NULL"
                is_deleted_expr = (
                    "COALESCE(is_deleted, 0)" if "is_deleted" in old_names else "0"
                )
                cursor.execute(
                    f"""
                    INSERT INTO calc_dictionary (id, family_list_id, calc_code, symbol_key, symbol_value, is_deleted, created_at)
                    SELECT id, family_list_id, {calc_code_expr}, symbol_key, symbol_value, {is_deleted_expr}, created_at
                    FROM calc_dictionary_old
                    """
                )
                cursor.execute("DROP TABLE calc_dictionary_old")

            cursor.execute(
                "UPDATE calc_dictionary SET is_deleted = 0 WHERE is_deleted IS NULL"
            )
            cursor.execute(
                "UPDATE calc_dictionary SET is_deleted = 1 WHERE is_deleted = 0 AND calc_code IS NULL"
            )
        conn.commit()
    finally:
        conn.close()


def create_project_db(display_name: str) -> Dict[str, str]:
    if not display_name.strip():
        raise ValueError("DB 이름을 입력하세요.")
    if not TEMPLATE_DB.exists():
        raise FileNotFoundError("기준 DB 파일을 찾을 수 없습니다.")
    target_path = _next_available_path(display_name)
    shutil.copy(TEMPLATE_DB, target_path)
    ensure_extra_tables(target_path)
    _register_entry(target_path.name, display_name)
    return _entry_from_path(target_path.name, _metadata_for(target_path.name))


def copy_project_db(
    source_file: str, display_name: Optional[str] = None
) -> Dict[str, str]:
    source_path = _resolve_path(source_file)
    source_meta = _metadata_for(source_file)
    source_display = source_meta.get("display_name", source_path.stem)
    new_display = (display_name or f"{source_display} Copy").strip()
    if not new_display:
        raise ValueError("복사할 이름을 입력하세요.")
    target_path = _next_available_path(new_display)
    shutil.copy(source_path, target_path)
    ensure_extra_tables(target_path)
    _register_entry(target_path.name, new_display)
    return _entry_from_path(target_path.name, _metadata_for(target_path.name))


def rename_project_db(source_file: str, new_display_name: str) -> Dict[str, str]:
    source_path = _resolve_path(source_file)
    if not new_display_name.strip():
        raise ValueError("새 이름을 입력하세요.")
    dest_path = _next_available_path(new_display_name, allow_same=source_file)
    if dest_path.name == source_file:
        created_at = _metadata_for(source_file).get("created_at")
        _register_entry(source_file, new_display_name, created_at)
        return _entry_from_path(source_file, _metadata_for(source_file))
    metadata = _metadata_for(source_file)
    created_at = metadata.get("created_at") or datetime.utcnow().isoformat()
    source_path.rename(dest_path)
    _remove_entry(source_file)
    _register_entry(dest_path.name, new_display_name, created_at)
    return _entry_from_path(dest_path.name, _metadata_for(dest_path.name))


def delete_project_db(file_name: str) -> None:
    target_path = _resolve_path(file_name)
    target_path.unlink()
    _remove_entry(file_name)


_WINDOWS_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|\?\*\x00-\x1F]')


def _sanitize_display_name_for_filename(value: str) -> str:
    raw = (value or "").strip() or "project"
    raw = _WINDOWS_INVALID_FILENAME_CHARS.sub("_", raw)
    raw = raw.rstrip(" .")
    return raw or "project"


def backup_project_db(source_file: str) -> Dict[str, str]:
    source_path = _resolve_path(source_file)
    metadata = _metadata_for(source_file)
    display_name = metadata.get("display_name", source_path.stem)

    backup_dir = PROJECT_DB_DIR / "backup"
    backup_dir.mkdir(parents=True, exist_ok=True)

    safe_display = _sanitize_display_name_for_filename(display_name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = backup_dir / f"{safe_display}_{timestamp}.db"
    counter = 1
    while candidate.exists():
        candidate = backup_dir / f"{safe_display}_{timestamp}_{counter}.db"
        counter += 1

    src_conn = sqlite3.connect(source_path.as_posix())
    try:
        dst_conn = sqlite3.connect(candidate.as_posix())
        try:
            src_conn.backup(dst_conn)
            dst_conn.commit()
        finally:
            dst_conn.close()
    finally:
        src_conn.close()

    return {
        "file_name": source_file,
        "display_name": display_name,
        "backup_file_name": candidate.name,
        "backup_created_at": datetime.now().isoformat(),
    }


def _fetch_metadata_row(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, key, value, pjt_abbr, pjt_description FROM project_metadata ORDER BY id LIMIT 1"
    )
    row = cursor.fetchone()
    if not row:
        cursor.execute(
            "INSERT INTO project_metadata (key, value, pjt_abbr, pjt_description) VALUES (?, ?, ?, ?)",
            ("default", "", None, None),
        )
        conn.commit()
        cursor.execute(
            "SELECT id, key, value, pjt_abbr, pjt_description FROM project_metadata ORDER BY id LIMIT 1"
        )
        row = cursor.fetchone()
    return row


def read_project_metadata(db_path: Path) -> Dict[str, Optional[str]]:
    ensure_extra_tables(db_path)
    conn = sqlite3.connect(db_path.as_posix())
    try:
        row = _fetch_metadata_row(conn)
        if not row:
            return {"pjt_abbr": None, "pjt_description": None}
        return {"pjt_abbr": row[3], "pjt_description": row[4]}
    finally:
        conn.close()


def update_project_metadata(
    db_path: Path, updates: Dict[str, Optional[str]]
) -> Dict[str, Optional[str]]:
    ensure_extra_tables(db_path)
    conn = sqlite3.connect(db_path.as_posix())
    try:
        row = _fetch_metadata_row(conn)
        if not row:
            return {"pjt_abbr": None, "pjt_description": None}
        current_abbr = row[3]
        current_desc = row[4]
        next_abbr = updates["pjt_abbr"] if "pjt_abbr" in updates else current_abbr
        next_desc = (
            updates["pjt_description"] if "pjt_description" in updates else current_desc
        )
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE project_metadata SET pjt_abbr = ?, pjt_description = ? WHERE id = ?",
            (next_abbr, next_desc, row[0]),
        )
        conn.commit()
        return {"pjt_abbr": next_abbr, "pjt_description": next_desc}
    finally:
        conn.close()

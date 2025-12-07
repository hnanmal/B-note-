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

FILENAME_PATTERN = re.compile(r"^[0-9a-z_\-]+\.db$")
EXTRA_TABLE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS project_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT
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


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    if not slug:
        slug = "project"
    return slug


def _next_available_path(
    display_name: str, *, allow_same: Optional[str] = None
) -> Path:
    base = _slugify(display_name)
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


def resolve_project_db_path(identifier: str) -> Path:
    candidate_file = identifier if identifier.endswith('.db') else f"{identifier}.db"
    return _resolve_path(candidate_file)


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
    for file_path in sorted(PROJECT_DB_DIR.glob("*.db")):
        metadata = manifest.get(file_path.name, {})
        items.append(_entry_from_path(file_path.name, metadata))
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items


def ensure_extra_tables(db_path: Path) -> None:
    conn = sqlite3.connect(db_path.as_posix())
    try:
        cursor = conn.cursor()
        for stmt in EXTRA_TABLE_STATEMENTS:
            cursor.execute(stmt)
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

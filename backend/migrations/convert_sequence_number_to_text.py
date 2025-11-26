"""Migration utility to convert `family_list.sequence_number` to TEXT."""

from __future__ import annotations

import sqlite3
from pathlib import Path
import sys

DB_PATH = Path(__file__).resolve().parents[1] / "b-note-dev.db"

NEW_TABLE_SQL = """CREATE TABLE family_list (
    id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    item_type VARCHAR NOT NULL,
    parent_id INTEGER,
    created_at DATETIME NOT NULL,
    sequence_number TEXT,
    description TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY(parent_id) REFERENCES family_list (id)
)
"""

INDEX_SQL = "CREATE INDEX ix_family_list_id ON family_list (id)"


def _needs_rebuild(cursor: sqlite3.Cursor) -> bool:
    cursor.execute("PRAGMA table_info('family_list')")
    columns = {row[1]: row[2].upper() for row in cursor.fetchall()}
    seq_type = columns.get("sequence_number")
    if seq_type is None:
        raise RuntimeError("`family_list` does not have a `sequence_number` column")
    return seq_type != "TEXT"


def _drop_if_exists(cursor: sqlite3.Cursor, table_name: str) -> None:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    if cursor.fetchone() is not None:
        cursor.execute(f"DROP TABLE {table_name}")


def _rebuild_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("ALTER TABLE family_list RENAME TO family_list_old")
    cursor.execute(NEW_TABLE_SQL)
    cursor.execute(
        "INSERT INTO family_list (id, name, item_type, parent_id, created_at, sequence_number, description)"
        " SELECT id, name, item_type, parent_id, created_at, sequence_number, description"
        " FROM family_list_old"
    )
    cursor.execute("DROP TABLE family_list_old")
    cursor.execute(INDEX_SQL)


def main() -> int:
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return 1

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = OFF")
        try:
            if not _needs_rebuild(cursor):
                print("`sequence_number` is already TEXT; no migration needed.")
                return 0
            _drop_if_exists(cursor, "family_list_old")
            _rebuild_table(cursor)
        finally:
            cursor.execute("PRAGMA foreign_keys = ON")
    print("`family_list.sequence_number` is now TEXT.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

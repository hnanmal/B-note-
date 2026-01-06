from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os

from sqlalchemy.exc import OperationalError

# 개발용 SQLite 데이터베이스 설정
db_file = Path(__file__).resolve().parent / "b-note-dev.db"
# Allow overriding via environment variable (e.g., DATABASE_URL="sqlite:///C:/path/to/file.db")
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{db_file.as_posix()}")

# TODO: 프로덕션 환경에서는 PostgreSQL 주소로 변경
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@host:port/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite 사용 시에만 필요
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_family_list_columns(engine):
    with engine.connect() as conn:
        try:
            columns = conn.execute(text("PRAGMA table_info('family_list')")).fetchall()
        except OperationalError:
            return
        column_names = [col[1] for col in columns]
        if "sequence_number" not in column_names:
            conn.execute(
                text("ALTER TABLE family_list ADD COLUMN sequence_number TEXT")
            )
        if "description" not in column_names:
            conn.execute(text("ALTER TABLE family_list ADD COLUMN description TEXT"))


def ensure_calc_dictionary_columns(engine):
    with engine.connect() as conn:
        try:
            columns = conn.execute(
                text("PRAGMA table_info('calc_dictionary')")
            ).fetchall()
        except OperationalError:
            return
        if not columns:
            return
        column_names = [col[1] for col in columns]
        if "calc_code" not in column_names:
            conn.execute(text("ALTER TABLE calc_dictionary ADD COLUMN calc_code TEXT"))

        # Ensure soft-delete flag.
        if "is_deleted" not in column_names:
            conn.execute(
                text(
                    "ALTER TABLE calc_dictionary ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"
                )
            )

        # Make family_list_id nullable (SQLite requires rebuild).
        notnull_by_name = {col[1]: col[3] for col in columns}
        family_notnull = int(notnull_by_name.get("family_list_id", 0) or 0)
        if family_notnull == 1:
            conn.execute(text("ALTER TABLE calc_dictionary RENAME TO calc_dictionary_old"))
            conn.execute(
                text(
                    """
                    CREATE TABLE calc_dictionary (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        family_list_id INTEGER,
                        calc_code TEXT,
                        symbol_key TEXT NOT NULL,
                        symbol_value TEXT NOT NULL,
                        is_deleted INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME NOT NULL,
                        FOREIGN KEY(family_list_id) REFERENCES family_list(id)
                    )
                    """
                )
            )
            old_cols = conn.execute(text("PRAGMA table_info('calc_dictionary_old')")).fetchall()
            old_names = {col[1] for col in old_cols}
            calc_code_expr = "calc_code" if "calc_code" in old_names else "NULL"
            is_deleted_expr = "COALESCE(is_deleted, 0)" if "is_deleted" in old_names else "0"
            conn.execute(
                text(
                    f"""
                    INSERT INTO calc_dictionary (id, family_list_id, calc_code, symbol_key, symbol_value, is_deleted, created_at)
                    SELECT id, family_list_id, {calc_code_expr}, symbol_key, symbol_value, {is_deleted_expr}, created_at
                    FROM calc_dictionary_old
                    """
                )
            )
            conn.execute(text("DROP TABLE calc_dictionary_old"))

        # Normalize is_deleted values and keep legacy behavior: NULL calc_code rows were treated as deleted.
        conn.execute(text("UPDATE calc_dictionary SET is_deleted = 0 WHERE is_deleted IS NULL"))
        conn.execute(
            text(
                "UPDATE calc_dictionary SET is_deleted = 1 WHERE is_deleted = 0 AND calc_code IS NULL"
            )
        )


def ensure_gwm_family_assign_columns(engine):
    with engine.connect() as conn:
        try:
            columns = conn.execute(
                text("PRAGMA table_info('gwm_family_assign')")
            ).fetchall()
        except OperationalError:
            return
        column_names = [col[1] for col in columns]
        if "assigned_at" not in column_names:
            conn.execute(
                text("ALTER TABLE gwm_family_assign ADD COLUMN assigned_at DATETIME")
            )
        if "formula" not in column_names:
            conn.execute(text("ALTER TABLE gwm_family_assign ADD COLUMN formula TEXT"))
        if "description" not in column_names:
            conn.execute(
                text("ALTER TABLE gwm_family_assign ADD COLUMN description TEXT")
            )
        if "created_at" not in column_names:
            conn.execute(
                text("ALTER TABLE gwm_family_assign ADD COLUMN created_at DATETIME")
            )


def ensure_work_master_columns(engine):
    with engine.connect() as conn:
        try:
            columns = conn.execute(text("PRAGMA table_info('work_masters')")).fetchall()
        except OperationalError:
            return
        column_names = [col[1] for col in columns]
        if "add_spec" not in column_names:
            conn.execute(text("ALTER TABLE work_masters ADD COLUMN add_spec TEXT"))
        if "gauge" not in column_names:
            conn.execute(text("ALTER TABLE work_masters ADD COLUMN gauge TEXT"))
        indexes = conn.execute(text("PRAGMA index_list('work_masters')")).fetchall()
        if any(idx[1] == 'ix_work_masters_work_master_code' for idx in indexes):
            conn.execute(text("DROP INDEX IF EXISTS ix_work_masters_work_master_code"))


def ensure_standard_item_columns(engine):
    """Ensure legacy standard_items tables have the derive_from column."""
    with engine.connect() as conn:
        try:
            columns = conn.execute(text("PRAGMA table_info('standard_items')")).fetchall()
        except OperationalError:
            return
        column_names = [col[1] for col in columns]
        if 'derive_from' not in column_names:
            conn.execute(text("ALTER TABLE standard_items ADD COLUMN derive_from INTEGER"))


def ensure_family_revit_type_columns(engine):
    with engine.connect() as conn:
        try:
            columns = conn.execute(text("PRAGMA table_info('family_revit_type')")).fetchall()
        except OperationalError:
            columns = []
        column_names = [col[1] for col in columns]
        if not columns:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS family_revit_type (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        family_list_id INTEGER NOT NULL,
                        type_name TEXT NOT NULL,
                        building_name TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
            )
            return
        if 'building_name' not in column_names:
            conn.execute(text("ALTER TABLE family_revit_type ADD COLUMN building_name TEXT"))

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
        column_names = [col[1] for col in columns]
        if "calc_code" not in column_names:
            conn.execute(text("ALTER TABLE calc_dictionary ADD COLUMN calc_code TEXT"))


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

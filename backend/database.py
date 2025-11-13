from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 개발용 SQLite 데이터베이스 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./b-note-dev.db"

# TODO: 프로덕션 환경에서는 PostgreSQL 주소로 변경
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@host:port/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}  # SQLite 사용 시에만 필요
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
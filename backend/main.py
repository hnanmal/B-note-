from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import router
from .database import (
    engine,
    Base,
    ensure_family_list_columns,
    ensure_calc_dictionary_columns,
    ensure_gwm_family_assign_columns,
    ensure_work_master_columns,
)

# 데이터베이스 테이블 생성
tables_to_create = [
    table
    for name, table in Base.metadata.tables.items()
    if name != "family_revit_type"
]
Base.metadata.create_all(bind=engine, tables=tables_to_create)
ensure_family_list_columns(engine)
ensure_calc_dictionary_columns(engine)
ensure_gwm_family_assign_columns(engine)
ensure_work_master_columns(engine)

app = FastAPI(
    title="B-note API",
    description="B-note 웹 애플리케이션을 위한 API 서버입니다.",
    version="0.1.0",
)

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],  # 개발 중에는 모든 출처를 허용. 배포 시에는 프론트엔드 주소만 명시.
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메소드 허용
    allow_headers=["*"],  # 모든 HTTP 헤더 허용
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "B-note API 서버에 오신 것을 환영합니다."}

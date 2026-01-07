from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from typing import List, Optional
import pandas as pd
import io
import json
import datetime
import sqlite3

from . import crud, project_db, schemas, models
from .database import SessionLocal
from . import database


# 데이터베이스 세션을 가져오는 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_project_db_session(project_identifier: str):
    try:
        db_path = project_db.resolve_project_db_path(project_identifier)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    project_db.ensure_extra_tables(db_path)
    project_engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    ProjectSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=project_engine
    )
    db = ProjectSessionLocal()
    try:
        yield db
    finally:
        db.close()
        project_engine.dispose()


router = APIRouter()


@router.get("/debug/ping", tags=["Debug"])
def debug_ping():
    return {"ok": True}


@router.get("/debug/db", tags=["Debug"])
def debug_db(db: Session = Depends(get_db)):
    try:
        cnt = db.query(models.StandardItem).count()
        return {"db_url": database.SQLALCHEMY_DATABASE_URL, "standard_items": cnt}
    except Exception as e:
        return {"db_url": database.SQLALCHEMY_DATABASE_URL, "error": str(e)}


# TODO: 실제 사용자 인증 로직으로 교체해야 합니다.
def get_current_user():
    # 임시로 고정된 사용자 ID를 반환합니다.
    return models.User(id=1, email="test@example.com", username="testuser")


@router.post("/projects/", response_model=schemas.Project)
def create_project_for_user(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.create_user_project(db=db, project=project, user_id=current_user.id)


# ===================
#        User
# ===================
@router.post("/users/", response_model=schemas.User, tags=["Users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


# ===================
#     WorkMaster
# ===================
@router.post("/work-masters/", response_model=schemas.WorkMaster, tags=["Work Masters"])
def create_work_master(
    work_master: schemas.WorkMasterCreate, db: Session = Depends(get_db)
):
    db_work_master = crud.get_work_master_by_work_master_code(
        db, code=work_master.work_master_code
    )
    if db_work_master:
        raise HTTPException(
            status_code=400,
            detail=f"WorkMaster with code '{work_master.work_master_code}' already exists",
        )
    return crud.create_work_master(db=db, work_master=work_master)


@router.get(
    "/work-masters/", response_model=List[schemas.WorkMaster], tags=["Work Masters"]
)
def read_work_masters(
    skip: int = 0,
    limit: int = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    work_masters = crud.get_work_masters(db, skip=skip, limit=limit, search=search)
    return work_masters


@router.get(
    "/work-masters/{work_master_id}",
    response_model=schemas.WorkMaster,
    tags=["Work Masters"],
)
def read_work_master(
    work_master_id: int,
    db: Session = Depends(get_db),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    return db_work_master


@router.post(
    "/work-masters/upload",
    summary="Upload and upsert Work Masters from Excel",
    tags=["Work Masters"],
)
async def upload_work_masters(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Please upload an .xlsx file."
        )

    created_count = 0
    updated_count = 0

    try:
        contents = await file.read()
        # 1. 4번째 행(header=3)을 컬럼명으로 읽고, 모든 데이터를 문자열(str)로 강제 변환합니다.
        df = pd.read_excel(io.BytesIO(contents), header=3, dtype=str)

        # 2. Pydantic 모델에 정의된 필드 이름을 순서대로 가져옵니다.
        model_fields = list(schemas.WorkMasterCreate.model_fields.keys())

        # 3. 엑셀 컬럼 개수와 모델 필드 개수가 다를 경우를 대비해, 모델 필드 개수만큼만 사용합니다.
        num_columns_to_use = min(len(df.columns), len(model_fields))
        df = df.iloc[:, :num_columns_to_use]
        df.columns = model_fields[:num_columns_to_use]

        for _, row in df.iterrows():
            # NaN 값을 None으로 변환하여 Pydantic 유효성 검사 통과
            row_data = row.where(pd.notna(row), None).to_dict()
            work_master_in = schemas.WorkMasterCreate(
                **row_data
            )  # 순서대로 매핑된 데이터로 객체 생성
            db_work_master = crud.get_work_master_by_work_master_code(
                db, code=work_master_in.work_master_code
            )

            if db_work_master:
                crud.update_work_master(
                    db, db_work_master=db_work_master, work_master_in=work_master_in
                )
                updated_count += 1
            else:
                crud.create_work_master(db, work_master=work_master_in)
                created_count += 1

        return {
            "message": "Work Masters uploaded successfully",
            "created": created_count,
            "updated": updated_count,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An error occurred while processing the file: {e}"
        )


@router.patch(
    "/work-masters/{work_master_id}",
    response_model=schemas.WorkMaster,
    tags=["Work Masters"],
)
def update_work_master(
    work_master_id: int,
    updates: schemas.WorkMasterUpdate,
    db: Session = Depends(get_db),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    payload = updates.dict(exclude_unset=True)
    if not payload:
        return db_work_master
    return crud.update_work_master_fields(
        db, db_work_master=db_work_master, updates=payload
    )


@router.get(
    "/project/{project_identifier}/work-masters/",
    response_model=List[schemas.WorkMaster],
    tags=["Project Data"],
)
def read_project_work_masters(
    project_identifier: str,
    skip: int = 0,
    limit: int = None,
    search: Optional[str] = None,
    db: Session = Depends(get_project_db_session),
):
    return crud.get_work_masters(db, skip=skip, limit=limit, search=search)


@router.post(
    "/project/{project_identifier}/work-masters/",
    response_model=schemas.WorkMaster,
    tags=["Project Data"],
)
def create_project_work_master(
    project_identifier: str,
    work_master: schemas.WorkMasterCreate,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master_by_work_master_code(
        db, code=work_master.work_master_code
    )
    if db_work_master:
        raise HTTPException(
            status_code=400,
            detail=f"WorkMaster with code '{work_master.work_master_code}' already exists",
        )
    return crud.create_work_master(db=db, work_master=work_master)


# ===================
#  WorkMaster Precheck
# ===================
@router.get(
    "/project/{project_identifier}/work-masters/precheck",
    response_model=List[schemas.WorkMasterPrecheckState],
    tags=["Project Data"],
)
def read_project_work_master_precheck_states(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    rows = db.execute(
        text(
            "SELECT work_master_id, use_yn, updated_at FROM work_master_precheck ORDER BY work_master_id"
        )
    ).fetchall()
    result: List[schemas.WorkMasterPrecheckState] = []
    for row in rows:
        result.append(
            schemas.WorkMasterPrecheckState(
                work_master_id=int(row[0]),
                use_yn=bool(row[1]),
                updated_at=row[2],
            )
        )
    return result


@router.patch(
    "/project/{project_identifier}/work-masters/{work_master_id}/precheck",
    response_model=schemas.WorkMasterPrecheckState,
    tags=["Project Data"],
)
def update_project_work_master_precheck_state(
    project_identifier: str,
    work_master_id: int,
    updates: schemas.WorkMasterPrecheckUpdate,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")

    now = datetime.datetime.utcnow().isoformat()
    use_value = 1 if updates.use_yn else 0

    db.execute(
        text(
            """
            INSERT INTO work_master_precheck (work_master_id, use_yn, updated_at)
            VALUES (:work_master_id, :use_yn, :updated_at)
            ON CONFLICT(work_master_id)
            DO UPDATE SET use_yn = excluded.use_yn, updated_at = excluded.updated_at
            """
        ),
        {"work_master_id": work_master_id, "use_yn": use_value, "updated_at": now},
    )
    db.commit()
    return schemas.WorkMasterPrecheckState(
        work_master_id=work_master_id,
        use_yn=updates.use_yn,
        updated_at=now,
    )


@router.post(
    "/project/{project_identifier}/work-masters/upload",
    summary="Upload and upsert Work Masters from Excel",
    tags=["Project Data"],
)
async def upload_project_work_masters(
    project_identifier: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_project_db_session),
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Please upload an .xlsx file."
        )

    created_count = 0
    updated_count = 0

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents), header=3, dtype=str)
        model_fields = list(schemas.WorkMasterCreate.model_fields.keys())
        num_columns_to_use = min(len(df.columns), len(model_fields))
        df = df.iloc[:, :num_columns_to_use]
        df.columns = model_fields[:num_columns_to_use]

        for _, row in df.iterrows():
            row_data = row.where(pd.notna(row), None).to_dict()
            work_master_in = schemas.WorkMasterCreate(**row_data)
            db_work_master = crud.get_work_master_by_work_master_code(
                db, code=work_master_in.work_master_code
            )

            if db_work_master:
                crud.update_work_master(
                    db, db_work_master=db_work_master, work_master_in=work_master_in
                )
                updated_count += 1
            else:
                crud.create_work_master(db, work_master=work_master_in)
                created_count += 1

        return {
            "message": "Work Masters uploaded successfully",
            "created": created_count,
            "updated": updated_count,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An error occurred while processing the file: {e}"
        )


@router.patch(
    "/project/{project_identifier}/work-masters/{work_master_id}",
    response_model=schemas.WorkMaster,
    tags=["Project Data"],
)
def update_project_work_master(
    project_identifier: str,
    work_master_id: int,
    updates: schemas.WorkMasterUpdate,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    payload = updates.dict(exclude_unset=True)
    if not payload:
        return db_work_master
    return crud.update_work_master_fields(
        db, db_work_master=db_work_master, updates=payload
    )


@router.get(
    "/project/{project_identifier}/work-masters/{work_master_id}",
    response_model=schemas.WorkMaster,
    tags=["Project Data"],
)
def read_project_work_master(
    project_identifier: str,
    work_master_id: int,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    return db_work_master


@router.post(
    "/project/{project_identifier}/work-masters/{work_master_id}/add-gauge",
    response_model=schemas.WorkMaster,
    tags=["Project Data"],
)
def add_project_work_master_gauge(
    project_identifier: str,
    work_master_id: int,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    try:
        new_work_master = crud.duplicate_work_master_with_gauge(
            db, work_master_id=work_master_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not new_work_master:
        raise HTTPException(status_code=500, detail="게이지 항목을 생성할 수 없습니다.")
    return new_work_master


@router.post(
    "/project/{project_identifier}/work-masters/{work_master_id}/remove-gauge",
    tags=["Project Data"],
)
def remove_project_work_master_gauge(
    project_identifier: str,
    work_master_id: int,
    db: Session = Depends(get_project_db_session),
):
    db_work_master = crud.get_work_master(db, work_master_id=work_master_id)
    if not db_work_master:
        raise HTTPException(status_code=404, detail="WorkMaster not found")
    try:
        remaining = crud.remove_work_master_gauge(db, work_master_id=work_master_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if remaining is None:
        raise HTTPException(status_code=404, detail="게이지 항목을 삭제할 수 없습니다.")
    return {"remaining_gauges": len(remaining)}


# ===================
#  WorkMaster Cart
# ===================
def _normalize_cart_payload(raw_payload):
    def _ensure_list(value):
        return value if isinstance(value, list) else []

    revit_types = raw_payload.get("revitTypes") or raw_payload.get("revit_types") or []
    assignment_ids = (
        raw_payload.get("assignmentIds") or raw_payload.get("assignment_ids") or []
    )
    standard_item_ids = (
        raw_payload.get("standardItemIds") or raw_payload.get("standard_item_ids") or []
    )
    building_names = (
        raw_payload.get("buildingNames") or raw_payload.get("building_names") or []
    )
    formula = raw_payload.get("formula")
    return {
        "revit_types": _ensure_list(revit_types),
        "assignment_ids": _ensure_list(assignment_ids),
        "standard_item_ids": _ensure_list(standard_item_ids),
        "building_names": _ensure_list(building_names),
        "formula": formula,
    }


@router.get(
    "/project/{project_identifier}/workmaster-cart",
    response_model=List[schemas.WorkMasterCartEntry],
    tags=["Project Data"],
)
def read_project_workmaster_cart(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    rows = db.execute(
        text(
            "SELECT id, payload, created_at FROM workmaster_cart_entries ORDER BY id DESC"
        )
    ).fetchall()
    entries: List[schemas.WorkMasterCartEntry] = []
    for row in rows:
        try:
            payload = json.loads(row[1] or "{}")
        except json.JSONDecodeError:
            payload = {}
        normalized = _normalize_cart_payload(payload)
        created_raw = row[2]
        try:
            created_at = (
                datetime.datetime.fromisoformat(created_raw)
                if created_raw
                else datetime.datetime.utcnow()
            )
        except ValueError:
            created_at = datetime.datetime.utcnow()
        entries.append(
            schemas.WorkMasterCartEntry(
                id=row[0],
                created_at=created_at,
                **normalized,
            )
        )
    return entries


@router.post(
    "/project/{project_identifier}/workmaster-cart",
    response_model=schemas.WorkMasterCartEntry,
    tags=["Project Data"],
)
def create_project_workmaster_cart_entry(
    project_identifier: str,
    payload: schemas.WorkMasterCartEntryCreate,
    db: Session = Depends(get_project_db_session),
):
    normalized = _normalize_cart_payload(payload.model_dump())
    now_iso = datetime.datetime.utcnow().isoformat()
    db.execute(
        text(
            "INSERT INTO workmaster_cart_entries (payload, created_at) VALUES (:payload, :created_at)"
        ),
        {"payload": json.dumps(normalized, ensure_ascii=False), "created_at": now_iso},
    )
    db.commit()
    new_id = db.execute(text("SELECT last_insert_rowid()")).scalar()
    created_at = datetime.datetime.fromisoformat(now_iso)
    return schemas.WorkMasterCartEntry(id=new_id, created_at=created_at, **normalized)


@router.patch(
    "/project/{project_identifier}/workmaster-cart/{entry_id}",
    response_model=schemas.WorkMasterCartEntry,
    tags=["Project Data"],
)
def update_project_workmaster_cart_entry(
    project_identifier: str,
    entry_id: int,
    payload: schemas.WorkMasterCartEntryUpdate,
    db: Session = Depends(get_project_db_session),
):
    row = db.execute(
        text(
            "SELECT payload, created_at FROM workmaster_cart_entries WHERE id = :entry_id"
        ),
        {"entry_id": entry_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cart entry not found")
    try:
        current_payload = json.loads(row[0] or "{}")
    except json.JSONDecodeError:
        current_payload = {}
    if payload.formula is not None:
        current_payload["formula"] = payload.formula
    normalized = _normalize_cart_payload(current_payload)
    db.execute(
        text(
            "UPDATE workmaster_cart_entries SET payload = :payload WHERE id = :entry_id"
        ),
        {"payload": json.dumps(normalized, ensure_ascii=False), "entry_id": entry_id},
    )
    db.commit()
    created_raw = row[1]
    try:
        created_at = (
            datetime.datetime.fromisoformat(created_raw)
            if created_raw
            else datetime.datetime.utcnow()
        )
    except ValueError:
        created_at = datetime.datetime.utcnow()
    return schemas.WorkMasterCartEntry(id=entry_id, created_at=created_at, **normalized)


@router.delete(
    "/project/{project_identifier}/workmaster-cart/{entry_id}",
    tags=["Project Data"],
)
def delete_project_workmaster_cart_entry(
    project_identifier: str,
    entry_id: int,
    db: Session = Depends(get_project_db_session),
):
    result = db.execute(
        text("DELETE FROM workmaster_cart_entries WHERE id = :entry_id"),
        {"entry_id": entry_id},
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Cart entry not found")
    return {"ok": True}


# ===================
#   StandardItem
# ===================
@router.get(
    "/standard-items/",
    response_model=List[schemas.StandardItem],
    tags=["Standard Items"],
)
def read_standard_items(
    skip: int = 0,
    limit: int = None,
    search: Optional[str] = None,
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return crud.get_standard_items(
        db=db, skip=skip, limit=limit, search=search, parent_id=parent_id
    )


@router.post(
    "/standard-items/{standard_item_id}/assign",
    tags=["Standard Items"],
)
def assign_work_master(
    standard_item_id: int,
    payload: schemas.AssignWorkMaster,
    db: Session = Depends(get_db),
):
    std = crud.assign_work_master_to_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=payload.work_master_id
    )
    if not std:
        raise HTTPException(
            status_code=404, detail="StandardItem or WorkMaster not found"
        )
    return {"message": "assigned", "standard_item_id": std.id}


@router.post(
    "/standard-items/{standard_item_id}/remove",
    tags=["Standard Items"],
)
def remove_work_master(
    standard_item_id: int,
    payload: schemas.AssignWorkMaster,
    db: Session = Depends(get_db),
):
    std = crud.remove_work_master_from_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=payload.work_master_id
    )
    if not std:
        raise HTTPException(
            status_code=404, detail="StandardItem or WorkMaster not found"
        )
    return {"message": "removed", "standard_item_id": std.id}


@router.post(
    "/standard-items/{standard_item_id}/select",
    tags=["Standard Items"],
)
def select_standard_item_work_master(
    standard_item_id: int,
    selection: schemas.StandardItemWorkMasterSelectionRequest,
    db: Session = Depends(get_db),
):
    std = crud.get_standard_item(db, standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    result = crud.select_work_master_for_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=selection.work_master_id
    )
    return {"selected_work_master_id": result.work_master_id if result else None}


# Create standard item
@router.post(
    "/standard-items/", response_model=schemas.StandardItem, tags=["Standard Items"]
)
def create_standard_item(
    item: schemas.StandardItemCreate, db: Session = Depends(get_db)
):
    return crud.create_standard_item(db=db, standard_item=item)


@router.get(
    "/project/{project_identifier}/standard-items/",
    response_model=List[schemas.StandardItem],
    tags=["Project Data"],
)
def read_project_standard_items(
    project_identifier: str,
    skip: int = 0,
    limit: int = None,
    search: Optional[str] = None,
    parent_id: Optional[int] = None,
    db: Session = Depends(get_project_db_session),
):
    return crud.get_standard_items(
        db=db, skip=skip, limit=limit, search=search, parent_id=parent_id
    )


@router.get(
    "/project/{project_identifier}/standard-items/{standard_item_id}",
    response_model=schemas.StandardItem,
    tags=["Project Data"],
)
def get_project_standard_item(
    project_identifier: str,
    standard_item_id: int,
    db: Session = Depends(get_project_db_session),
):
    std = crud.get_standard_item(db, standard_item_id=standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return std


@router.post(
    "/project/{project_identifier}/standard-items/{standard_item_id}/assign",
    tags=["Project Data"],
)
def assign_work_master_to_project(
    project_identifier: str,
    standard_item_id: int,
    payload: schemas.AssignWorkMaster,
    db: Session = Depends(get_project_db_session),
):
    std = crud.assign_work_master_to_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=payload.work_master_id
    )
    if not std:
        raise HTTPException(
            status_code=404, detail="StandardItem or WorkMaster not found"
        )
    return {"message": "assigned", "standard_item_id": std.id}


@router.post(
    "/project/{project_identifier}/standard-items/{standard_item_id}/remove",
    tags=["Project Data"],
)
def remove_project_work_master(
    project_identifier: str,
    standard_item_id: int,
    payload: schemas.AssignWorkMaster,
    db: Session = Depends(get_project_db_session),
):
    std = crud.remove_work_master_from_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=payload.work_master_id
    )
    if not std:
        raise HTTPException(
            status_code=404, detail="StandardItem or WorkMaster not found"
        )
    return {"message": "removed", "standard_item_id": std.id}


@router.post(
    "/project/{project_identifier}/standard-items/{standard_item_id}/select",
    tags=["Project Data"],
)
def select_project_standard_item_work_master(
    project_identifier: str,
    standard_item_id: int,
    selection: schemas.StandardItemWorkMasterSelectionRequest,
    db: Session = Depends(get_project_db_session),
):
    std = crud.get_standard_item(db, standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    result = crud.select_work_master_for_standard_item(
        db, standard_item_id=standard_item_id, work_master_id=selection.work_master_id
    )
    return {"selected_work_master_id": result.work_master_id if result else None}


@router.get(
    "/project/{project_identifier}/work-master-selections/summary",
    response_model=schemas.WorkMasterSummaryResponse,
    tags=["Project Data"],
)
def get_project_work_master_selection_summary(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    rows = crud.list_selected_work_master_summary(db)
    return {"rows": rows}


@router.get(
    "/project/{project_identifier}/export/dynamo-json",
    response_model=schemas.DynamoProjectExportPayload,
    tags=["Project Data"],
)
def export_project_db_for_dynamo(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    """Dynamo 테스트를 위한 프로젝트 DB JSON 추출 엔드포인트.

    - 추후에는 "파일 다운로드" 대신 Dynamo가 직접 참조하는 라우터로 사용 가능
    """

    buildings = crud.list_buildings(db)
    cart_entries = read_project_workmaster_cart(
        project_identifier=project_identifier, db=db
    )

    pjt_abbr = None
    try:
        pjt_abbr_row = db.execute(
            text("SELECT pjt_abbr FROM project_metadata ORDER BY id LIMIT 1")
        ).fetchone()
        if pjt_abbr_row and pjt_abbr_row[0]:
            pjt_abbr = str(pjt_abbr_row[0]).strip() or None
    except Exception:
        pjt_abbr = None

    assignment_ids = sorted(
        {
            int(aid)
            for entry in cart_entries
            for aid in (getattr(entry, "assignment_ids", None) or [])
            if isinstance(aid, int) or (isinstance(aid, str) and aid.isdigit())
        }
    )
    standard_item_ids = sorted(
        {
            int(sid)
            for entry in cart_entries
            for sid in (getattr(entry, "standard_item_ids", None) or [])
            if isinstance(sid, int) or (isinstance(sid, str) and sid.isdigit())
        }
    )

    assignment_label_by_id = {}
    assignment_family_list_id_by_id = {}
    family_name_by_family_list_id = {}
    assignment_standard_item_ids = set()
    assignment_family_name_by_id = {}
    assignment_standard_item_id_by_id = {}
    if assignment_ids:
        assigns = (
            db.query(models.GwmFamilyAssign)
            .filter(models.GwmFamilyAssign.id.in_(assignment_ids))
            .all()
        )
        for a in assigns:
            family_name = getattr(getattr(a, "family_list_item", None), "name", None)
            standard_item_id = getattr(a, "standard_item_id", None)
            if standard_item_id is not None:
                try:
                    assignment_standard_item_ids.add(int(standard_item_id))
                except (TypeError, ValueError):
                    pass
            if family_name:
                assignment_family_name_by_id[a.id] = family_name
            if standard_item_id is not None:
                try:
                    assignment_standard_item_id_by_id[a.id] = int(standard_item_id)
                except (TypeError, ValueError):
                    pass
            family_list_id = getattr(a, "family_list_id", None)
            if family_list_id is not None:
                try:
                    family_list_id_int = int(family_list_id)
                except (TypeError, ValueError):
                    family_list_id_int = None
                if family_list_id_int is not None:
                    assignment_family_list_id_by_id[a.id] = family_list_id_int
                    if family_name:
                        family_name_by_family_list_id[family_list_id_int] = family_name

    standard_item_name_by_id = {}
    standard_item_ids_to_load = sorted(
        set(standard_item_ids) | set(assignment_standard_item_ids)
    )
    if standard_item_ids_to_load:
        items = (
            db.query(models.StandardItem)
            .filter(models.StandardItem.id.in_(standard_item_ids_to_load))
            .all()
        )
        derive_from_by_id = {}
        for item in items:
            standard_item_name_by_id[int(item.id)] = item.name
            derive_from_by_id[int(item.id)] = getattr(item, "derive_from", None)

        parent_ids = sorted(
            {
                int(pid)
                for pid in (derive_from_by_id.values() or [])
                if pid is not None
                and (
                    isinstance(pid, int)
                    or (isinstance(pid, str) and str(pid).isdigit())
                )
            }
        )
        missing_parent_ids = [
            pid for pid in parent_ids if pid not in standard_item_name_by_id
        ]
        if missing_parent_ids:
            parent_items = (
                db.query(models.StandardItem)
                .filter(models.StandardItem.id.in_(missing_parent_ids))
                .all()
            )
            for parent in parent_items:
                standard_item_name_by_id[int(parent.id)] = parent.name

        formatted_name_by_id = {}
        for item_id, name in list(standard_item_name_by_id.items()):
            derive_from = derive_from_by_id.get(item_id)
            if derive_from is None:
                formatted_name_by_id[item_id] = name
                continue
            try:
                parent_id = int(derive_from)
            except (TypeError, ValueError):
                formatted_name_by_id[item_id] = name
                continue
            parent_name = standard_item_name_by_id.get(parent_id)
            if not parent_name:
                formatted_name_by_id[item_id] = name
                continue
            if pjt_abbr:
                formatted_name_by_id[item_id] = f"{parent_name} [{pjt_abbr}]::{name}"
            else:
                formatted_name_by_id[item_id] = f"{parent_name}::{name}"

        standard_item_name_by_id = formatted_name_by_id

    if assignment_ids:
        for aid in assignment_ids:
            family_name = assignment_family_name_by_id.get(aid)
            standard_item_id = assignment_standard_item_id_by_id.get(aid)
            standard_name = (
                standard_item_name_by_id.get(standard_item_id)
                if standard_item_id is not None
                else None
            )
            if family_name and standard_name:
                assignment_label_by_id[aid] = f"{family_name} / {standard_name}"
            elif standard_name:
                assignment_label_by_id[aid] = standard_name
            elif family_name:
                assignment_label_by_id[aid] = family_name
            else:
                assignment_label_by_id[aid] = f"assignment:{aid}"

    selected_work_master_by_standard_item_id = {}
    if standard_item_ids:
        rows = (
            db.query(
                models.StandardItemWorkMasterSelect.standard_item_id,
                models.WorkMaster.id,
                models.WorkMaster.work_master_code,
                models.WorkMaster.gauge,
            )
            .join(
                models.WorkMaster,
                models.WorkMaster.id
                == models.StandardItemWorkMasterSelect.work_master_id,
            )
            .filter(
                models.StandardItemWorkMasterSelect.standard_item_id.in_(
                    standard_item_ids
                )
            )
            .all()
        )
        for standard_item_id, work_master_id, work_master_code, gauge in rows:
            selected_work_master_by_standard_item_id[int(standard_item_id)] = {
                "id": int(work_master_id),
                "work_master_code": work_master_code,
                "gauge": gauge,
            }

    calc_dictionary_entries_by_family_list_id = {}
    family_list_ids = sorted({fid for fid in assignment_family_list_id_by_id.values()})
    if family_list_ids:
        calc_entries = (
            db.query(models.CalcDictionaryEntry)
            .filter(models.CalcDictionaryEntry.family_list_id.in_(family_list_ids))
            .order_by(
                models.CalcDictionaryEntry.family_list_id,
                models.CalcDictionaryEntry.symbol_key,
            )
            .all()
        )
        for entry in calc_entries:
            fid = int(getattr(entry, "family_list_id", 0) or 0)
            if not fid:
                continue
            calc_dictionary_entries_by_family_list_id.setdefault(fid, []).append(
                schemas.CalcDictionarySymbol(
                    family_list_id=fid,
                    family_name=family_name_by_family_list_id.get(fid),
                    calc_code=getattr(entry, "calc_code", None),
                    symbol_key=getattr(entry, "symbol_key", ""),
                    symbol_value=getattr(entry, "symbol_value", ""),
                )
            )

    for entry in cart_entries:
        entry.assignment_labels = [
            assignment_label_by_id.get(int(aid), f"assignment:{aid}")
            for aid in (entry.assignment_ids or [])
        ]
        entry.standard_item_names = [
            standard_item_name_by_id.get(int(sid), f"standard_item:{sid}")
            for sid in (entry.standard_item_ids or [])
        ]
        entry.work_masters = [
            schemas.WorkMasterBrief(**wm)
            for sid in (entry.standard_item_ids or [])
            for wm in [selected_work_master_by_standard_item_id.get(int(sid))]
            if wm
        ]

        family_list_ids_for_entry = []
        seen_family_list_ids = set()
        for aid in entry.assignment_ids or []:
            try:
                aid_int = int(aid)
            except (TypeError, ValueError):
                continue
            fid = assignment_family_list_id_by_id.get(aid_int)
            if not fid or fid in seen_family_list_ids:
                continue
            seen_family_list_ids.add(fid)
            family_list_ids_for_entry.append(fid)

        entry.calc_dictionary_entries = [
            calc_entry
            for fid in family_list_ids_for_entry
            for calc_entry in calc_dictionary_entries_by_family_list_id.get(fid, [])
        ]

    def _first_from(value):
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            return value[0] if value else None
        return value

    def _coerce_int(value):
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            if value.isdigit():
                return int(value)
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _coerce_str(value):
        if value is None:
            return None
        text_value = str(value).strip()
        return text_value or None

    dynamo_cart_entries = []
    for entry in cart_entries:
        wm = _first_from(getattr(entry, "work_masters", None) or [])
        if wm is not None and not isinstance(wm, schemas.WorkMasterBrief):
            try:
                wm = schemas.WorkMasterBrief(**wm)
            except Exception:
                wm = None

        dynamo_cart_entries.append(
            schemas.DynamoWorkMasterCartEntry(
                id=int(getattr(entry, "id")),
                created_at=getattr(entry, "created_at"),
                formula=getattr(entry, "formula", None),
                revit_type=_coerce_str(
                    _first_from(getattr(entry, "revit_types", None) or [])
                ),
                assignment_id=_coerce_int(
                    _first_from(getattr(entry, "assignment_ids", None) or [])
                ),
                standard_item_id=_coerce_int(
                    _first_from(getattr(entry, "standard_item_ids", None) or [])
                ),
                building_name=_coerce_str(
                    _first_from(getattr(entry, "building_names", None) or [])
                ),
                assignment_label=_coerce_str(
                    _first_from(getattr(entry, "assignment_labels", None) or [])
                ),
                standard_item_name=_coerce_str(
                    _first_from(getattr(entry, "standard_item_names", None) or [])
                ),
                work_master=wm,
                calc_dictionary_entries=list(
                    getattr(entry, "calc_dictionary_entries", None) or []
                ),
            )
        )
    return {
        "project_identifier": project_identifier,
        "buildings": buildings,
        "workmaster_cart_entries": dynamo_cart_entries,
    }


@router.get(
    "/project/{project_identifier}/export/db-json",
    response_model=schemas.DynamoProjectExportPayload,
    tags=["Project Data"],
)
def export_project_db_json(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    """Compatibility alias for the Dynamo JSON export.

    Frontend uses `/export/db-json` for the Dynamo download button.
    """

    return export_project_db_for_dynamo(project_identifier=project_identifier, db=db)


@router.get(
    "/project/{project_identifier}/export/db-excel",
    tags=["Project Data"],
)
def export_project_db_excel(project_identifier: str):
    """Export a human-reviewable Excel report for the project DB.

    NOTE: This is intentionally *not* a raw table dump. It generates joined/flattened
    sheets so a person can review without jumping across tables.
    """

    try:
        db_path = project_db.resolve_project_db_path(project_identifier)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    project_db.ensure_extra_tables(db_path)

    try:
        from openpyxl import Workbook
        from openpyxl.utils import get_column_letter
        from openpyxl.styles import Alignment
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Excel export dependency missing")

    def _safe_sheet_name(name: str, existing: set) -> str:
        base = (name or "Sheet").strip() or "Sheet"
        cleaned = "".join(ch for ch in base if ch not in "[]:*?/\\")
        cleaned = cleaned[:31] or "Sheet"
        candidate = cleaned
        counter = 1
        while candidate in existing:
            suffix = f"_{counter}"
            candidate = (cleaned[: max(0, 31 - len(suffix))] + suffix)[:31]
            counter += 1
        existing.add(candidate)
        return candidate

    def _excel_value(value):
        if value is None:
            return None
        if isinstance(value, bytes):
            try:
                return value.decode("utf-8", errors="replace")
            except Exception:
                return value.hex()
        if isinstance(value, (dict, list)):
            try:
                return json.dumps(value, ensure_ascii=False)
            except Exception:
                return str(value)
        return value

    def _excel_escape_formula(value):
        if value is None:
            return None
        text_value = str(value)
        if not text_value:
            return text_value
        return text_value if text_value.startswith("'") else f"'{text_value}"

    wb = Workbook()
    if wb.worksheets:
        wb.remove(wb.worksheets[0])

    sheet_names = set()
    generated_at = datetime.datetime.now().isoformat(timespec="seconds")

    def _write_sheet_from_df(title: str, df: "pd.DataFrame"):
        ws = wb.create_sheet(_safe_sheet_name(title, sheet_names))
        ws.freeze_panes = "A2"

        if df is None or df.empty:
            ws.append(["(no rows)"])
            return ws

        ws.append(list(df.columns))
        for _, row in df.iterrows():
            ws.append([_excel_value(v) for v in row.tolist()])

        # Basic width cap to keep file readable
        for idx, col_name in enumerate(df.columns, start=1):
            col_letter = get_column_letter(idx)
            max_len = len(str(col_name))
            for cell in ws[col_letter]:
                if cell.value is None:
                    continue
                max_len = max(max_len, len(str(cell.value)))
                if max_len > 60:
                    max_len = 60
                    break
            ws.column_dimensions[col_letter].width = min(60, max(10, max_len + 2))

        return ws

    conn = sqlite3.connect(db_path.as_posix())
    try:

        def _natural_key(text: str):
            import re

            value = (text or "").strip().casefold()
            parts = re.split(r"(\d+)", value)
            key = []
            for part in parts:
                if part.isdigit():
                    try:
                        key.append(int(part))
                    except Exception:
                        key.append(part)
                else:
                    key.append(part)
            return key

        def _parse_sequence_identifier(value):
            import re

            trimmed = str(value).strip() if value is not None else ""
            if not trimmed:
                return None
            match = re.match(r"^(\d+(?:\.\d+)*)([a-zA-Z]*)", trimmed)
            if not match:
                return None
            number_parts = []
            for seg in match.group(1).split("."):
                try:
                    number_parts.append(int(seg))
                except Exception:
                    return None
            suffix = (match.group(2) or "").lower()
            return {"numbers": number_parts, "suffix": suffix}

        def _get_sequence_identifier(node):
            return _parse_sequence_identifier(
                node.get("sequence_number")
            ) or _parse_sequence_identifier(node.get("name"))

        def _compare_sequence_identifiers(a, b):
            max_len = max(len(a["numbers"]), len(b["numbers"]))
            for i in range(max_len):
                va = a["numbers"][i] if i < len(a["numbers"]) else 0
                vb = b["numbers"][i] if i < len(b["numbers"]) else 0
                if va != vb:
                    return -1 if va < vb else 1
            if a["suffix"] != b["suffix"]:
                if not a["suffix"]:
                    return -1
                if not b["suffix"]:
                    return 1
                return -1 if a["suffix"] < b["suffix"] else 1
            return 0

        def _compare_family_nodes(a, b):
            ida = _get_sequence_identifier(a)
            idb = _get_sequence_identifier(b)
            if ida and idb:
                c = _compare_sequence_identifiers(ida, idb)
                if c != 0:
                    return c
            elif ida:
                return -1
            elif idb:
                return 1

            name_a = (a.get("name") or "").strip()
            name_b = (b.get("name") or "").strip()
            if not name_a:
                return 1 if name_b else 0
            if not name_b:
                return -1
            ka = _natural_key(name_a)
            kb = _natural_key(name_b)
            if ka == kb:
                return 0
            return -1 if ka < kb else 1

        def _build_family_tree_rows(items, assignments_by_family_id=None):
            from functools import cmp_to_key
            import math

            def _to_int_or_none(value):
                if value is None:
                    return None
                if isinstance(value, float) and math.isnan(value):
                    return None
                try:
                    text = str(value).strip()
                    if not text or text.lower() == "nan":
                        return None
                    return int(float(text))
                except Exception:
                    return None

            node_by_id = {}
            for item in items:
                node_id = _to_int_or_none(item.get("id"))
                if node_id is None:
                    continue
                parent_id = _to_int_or_none(item.get("parent_id"))
                node_by_id[node_id] = {
                    **item,
                    "id": node_id,
                    "parent_id": parent_id,
                    "children": [],
                }

            roots = []
            for node_id, node in node_by_id.items():
                parent_id = node.get("parent_id")
                if parent_id is not None and parent_id in node_by_id:
                    node_by_id[parent_id]["children"].append(node)
                else:
                    roots.append(node)

            def sort_nodes(nodes):
                nodes.sort(key=cmp_to_key(_compare_family_nodes))
                for n in nodes:
                    if n.get("children"):
                        sort_nodes(n["children"])

            sort_nodes(roots)

            rows = []

            assignments_by_family_id = assignments_by_family_id or {}

            def walk(nodes, level=0):
                for n in nodes:
                    seq = (n.get("sequence_number") or "").strip()
                    name = (n.get("name") or "").strip() or "Unnamed"
                    family_id = n.get("id")
                    rows.append(
                        {
                            "level": int(level),
                            "sequence_number": seq or None,
                            "name": name,
                            "item_type": n.get("item_type"),
                            "id": n.get("id"),
                            "parent_id": n.get("parent_id"),
                            "description": n.get("description"),
                            "formula": None,
                            "created_at": n.get("created_at"),
                        }
                    )

                    # Insert assigned standard items right under this family node.
                    for a in assignments_by_family_id.get(family_id, []) or []:
                        rows.append(
                            {
                                "level": int(level) + 1,
                                "sequence_number": None,
                                "name": a.get("standard_item_name"),
                                "item_type": a.get("standard_item_type"),
                                "id": a.get("assignment_id"),
                                "parent_id": family_id,
                                "description": a.get("assignment_description"),
                                "formula": _excel_escape_formula(a.get("formula")),
                                "created_at": a.get("assigned_at")
                                or a.get("created_at"),
                            }
                        )

                    children = n.get("children") or []
                    if children:
                        walk(children, level + 1)

            walk(roots, 0)
            return rows

        def _read_df(query: str, params=None) -> "pd.DataFrame":
            try:
                return pd.read_sql_query(query, conn, params=params)
            except Exception:
                return pd.DataFrame()

        # Summary / metadata
        summary_ws = wb.create_sheet(_safe_sheet_name("SUMMARY", sheet_names))
        summary_ws.append(["project_identifier", project_identifier])
        summary_ws.append(["db_file", db_path.name])
        summary_ws.append(["generated_at", generated_at])
        summary_ws.append([])
        summary_ws.append(["sheet", "rows"])

        # Family list (tree, as shown in app) + assigned standard items under each node.
        df_family_raw = _read_df(
            "SELECT id, parent_id, sequence_number, name, item_type, description, created_at FROM family_list ORDER BY id"
        )
        df_family_assignments = _read_df(
            """
            SELECT
              g.id AS assignment_id,
              g.family_list_id,
              si.name AS standard_item_name,
              si.type AS standard_item_type,
              g.formula,
              g.description AS assignment_description,
              g.assigned_at,
              g.created_at
            FROM gwm_family_assign g
            LEFT JOIN standard_items si ON si.id = g.standard_item_id
            ORDER BY g.family_list_id, si.type, si.name, g.id
            """
        )
        assignments_by_family_id = {}
        if df_family_assignments is not None and not df_family_assignments.empty:
            for _, r in df_family_assignments.iterrows():
                fid = r.get("family_list_id")
                try:
                    fid_int = int(fid) if fid is not None else None
                except Exception:
                    fid_int = None
                if fid_int is None:
                    continue
                assignments_by_family_id.setdefault(fid_int, []).append(
                    {
                        "assignment_id": r.get("assignment_id"),
                        "standard_item_name": r.get("standard_item_name"),
                        "standard_item_type": r.get("standard_item_type"),
                        "formula": r.get("formula"),
                        "assignment_description": r.get("assignment_description"),
                        "assigned_at": r.get("assigned_at"),
                        "created_at": r.get("created_at"),
                    }
                )

        family_rows = _build_family_tree_rows(
            df_family_raw.to_dict(orient="records") if not df_family_raw.empty else [],
            assignments_by_family_id=assignments_by_family_id,
        )
        df_family_tree = pd.DataFrame(family_rows)
        family_ws = _write_sheet_from_df("FamilyList", df_family_tree)
        if family_ws and df_family_tree is not None and not df_family_tree.empty:
            headers = [cell.value for cell in family_ws[1]]
            try:
                level_col = headers.index("level") + 1
                name_col = headers.index("name") + 1
            except ValueError:
                level_col = None
                name_col = None

            if level_col and name_col:
                for row_idx in range(2, family_ws.max_row + 1):
                    level_value = family_ws.cell(row=row_idx, column=level_col).value
                    try:
                        indent_level = int(level_value or 0)
                    except Exception:
                        indent_level = 0
                    name_cell = family_ws.cell(row=row_idx, column=name_col)
                    name_cell.alignment = Alignment(indent=indent_level, wrap_text=True)
        summary_ws.append(["FamilyList", int(len(df_family_tree.index))])

        df_buildings = _read_df(
            "SELECT id, name AS building_name, created_at FROM building_list ORDER BY id"
        )
        _write_sheet_from_df("Buildings", df_buildings)
        summary_ws.append(["Buildings", int(len(df_buildings.index))])

        df_standard_items = _read_df(
            "SELECT id, name AS standard_item_name, type AS standard_item_type, parent_id, derive_from FROM standard_items ORDER BY id"
        )
        _write_sheet_from_df("StandardItems", df_standard_items)
        summary_ws.append(["StandardItems", int(len(df_standard_items.index))])

        df_work_masters = _read_df(
            "SELECT id, discipline, work_master_code, cat_large_code, cat_large_desc, cat_mid_code, cat_mid_desc, cat_small_code, cat_small_desc, attr1_code, attr1_spec, attr2_code, attr2_spec, attr3_code, attr3_spec, attr4_code, attr4_spec, attr5_code, attr5_spec, attr6_code, attr6_spec, uom1, uom2, work_group_code, new_old_code, add_spec, gauge FROM work_masters ORDER BY id"
        )
        _write_sheet_from_df("WorkMasters", df_work_masters)
        summary_ws.append(["WorkMasters", int(len(df_work_masters.index))])

        df_selected = _read_df(
            """
            SELECT
              sel.id,
              sel.standard_item_id,
              si.name AS standard_item_name,
              si.type AS standard_item_type,
              sel.work_master_id,
              wm.work_master_code,
              wm.cat_large_code,
              wm.cat_mid_code,
              wm.cat_small_code,
              sel.created_at,
              sel.updated_at
            FROM standard_item_work_master_select sel
            LEFT JOIN standard_items si ON si.id = sel.standard_item_id
            LEFT JOIN work_masters wm ON wm.id = sel.work_master_id
            ORDER BY sel.standard_item_id
            """
        )
        _write_sheet_from_df("StandardItemSelections", df_selected)
        summary_ws.append(["StandardItemSelections", int(len(df_selected.index))])

        df_gwm_assign = _read_df(
            """
            SELECT
              g.id,
              g.family_list_id,
              fl.name AS family_name,
              g.standard_item_id,
              si.name AS standard_item_name,
              si.type AS standard_item_type,
              g.formula,
              g.description,
              g.assigned_at,
              g.created_at
            FROM gwm_family_assign g
            LEFT JOIN family_list fl ON fl.id = g.family_list_id
            LEFT JOIN standard_items si ON si.id = g.standard_item_id
            ORDER BY g.id
            """
        )
        if not df_gwm_assign.empty and "formula" in df_gwm_assign.columns:
            df_gwm_assign["formula"] = df_gwm_assign["formula"].map(
                _excel_escape_formula
            )
        _write_sheet_from_df("GwmFamilyAssign", df_gwm_assign)
        summary_ws.append(["GwmFamilyAssign", int(len(df_gwm_assign.index))])

        df_revit_types = _read_df(
            """
            SELECT
              frt.id,
              frt.family_list_id,
              fl.name AS family_name,
              frt.type_name,
              frt.building_name,
              frt.created_at
            FROM family_revit_type frt
            LEFT JOIN family_list fl ON fl.id = frt.family_list_id
            ORDER BY frt.id
            """
        )
        _write_sheet_from_df("FamilyRevitTypes", df_revit_types)
        summary_ws.append(["FamilyRevitTypes", int(len(df_revit_types.index))])

        df_calc = _read_df(
            """
            SELECT
              c.id,
              c.family_list_id,
              fl.name AS family_name,
              c.calc_code,
              c.symbol_key,
              c.symbol_value,
              c.created_at
            FROM calc_dictionary c
            LEFT JOIN family_list fl ON fl.id = c.family_list_id
            WHERE COALESCE(c.is_deleted, 0) = 0
            ORDER BY c.id
            """
        )
        _write_sheet_from_df("CalcDictionary", df_calc)
        summary_ws.append(["CalcDictionary", int(len(df_calc.index))])

        # Cart entries (flattened for review)
        df_cart_raw = _read_df(
            "SELECT id AS cart_entry_id, payload, created_at FROM workmaster_cart_entries ORDER BY id DESC"
        )
        std_name_by_id = (
            df_standard_items.set_index("id")["standard_item_name"].to_dict()
            if not df_standard_items.empty and "id" in df_standard_items.columns
            else {}
        )
        std_type_by_id = (
            df_standard_items.set_index("id")["standard_item_type"].to_dict()
            if not df_standard_items.empty and "id" in df_standard_items.columns
            else {}
        )
        sel_by_std_id = {}
        if not df_selected.empty and "standard_item_id" in df_selected.columns:
            for _, r in df_selected.iterrows():
                sid = r.get("standard_item_id")
                if sid is None:
                    continue
                sel_by_std_id[int(sid)] = {
                    "selected_work_master_id": r.get("work_master_id"),
                    "selected_work_master_code": r.get("work_master_code"),
                }

        cart_rows = []
        for _, r in df_cart_raw.iterrows():
            raw_payload = r.get("payload")
            try:
                payload = json.loads(raw_payload or "{}")
            except Exception:
                payload = {}
            normalized = _normalize_cart_payload(
                payload if isinstance(payload, dict) else {}
            )
            revit_types = normalized.get("revit_types") or []
            assignment_ids = normalized.get("assignment_ids") or []
            standard_item_ids = normalized.get("standard_item_ids") or []
            building_names = normalized.get("building_names") or []

            standard_item_id = None
            try:
                standard_item_id = (
                    int(standard_item_ids[0]) if standard_item_ids else None
                )
            except Exception:
                standard_item_id = None

            sel = (
                sel_by_std_id.get(standard_item_id)
                if standard_item_id is not None
                else None
            )
            cart_rows.append(
                {
                    "cart_entry_id": r.get("cart_entry_id"),
                    "created_at": r.get("created_at"),
                    "building_name": (building_names[0] if building_names else None),
                    "standard_item_id": standard_item_id,
                    "standard_item_name": std_name_by_id.get(standard_item_id),
                    "standard_item_type": std_type_by_id.get(standard_item_id),
                    "assignment_id": (assignment_ids[0] if assignment_ids else None),
                    "revit_type": (revit_types[0] if revit_types else None),
                    "formula": _excel_escape_formula(normalized.get("formula")),
                    "selected_work_master_id": (
                        sel.get("selected_work_master_id") if sel else None
                    ),
                    "selected_work_master_code": (
                        sel.get("selected_work_master_code") if sel else None
                    ),
                    "building_names_json": json.dumps(
                        building_names, ensure_ascii=False
                    ),
                    "standard_item_ids_json": json.dumps(
                        standard_item_ids, ensure_ascii=False
                    ),
                    "assignment_ids_json": json.dumps(
                        assignment_ids, ensure_ascii=False
                    ),
                    "revit_types_json": json.dumps(revit_types, ensure_ascii=False),
                }
            )
        df_cart = pd.DataFrame(cart_rows)
        _write_sheet_from_df("CartEntries", df_cart)
        summary_ws.append(["CartEntries", int(len(df_cart.index))])
    finally:
        conn.close()

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    now = datetime.datetime.now()
    stamp = now.strftime("%Y%m%d_%H%M%S")
    filename = f"db_report_{project_identifier}_{stamp}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post(
    "/project/{project_identifier}/standard-items/{standard_item_id}/derive",
    response_model=schemas.StandardItem,
    tags=["Project Data"],
)
def derive_project_standard_item_work_master(
    project_identifier: str,
    standard_item_id: int,
    payload: schemas.DerivedStandardItemCreate,
    db: Session = Depends(get_project_db_session),
):
    derived = crud.create_derived_standard_item(
        db,
        parent_id=standard_item_id,
        suffix_description=payload.suffix_description,
        work_master_id=payload.work_master_id,
    )
    if not derived:
        raise HTTPException(status_code=400, detail="Derived item could not be created")
    return derived


@router.delete(
    "/project/{project_identifier}/standard-items/{standard_item_id}",
    tags=["Project Data"],
)
def delete_project_standard_item(
    project_identifier: str,
    standard_item_id: int,
    db: Session = Depends(get_project_db_session),
):
    std = crud.delete_standard_item(db, standard_item_id=standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return {"message": "deleted", "standard_item_id": standard_item_id}


@router.post(
    "/project/{project_identifier}/standard-items/{standard_item_id}/rename",
    tags=["Project Data"],
)
def rename_project_standard_item(
    project_identifier: str,
    standard_item_id: int,
    payload: schemas.StandardItemRename,
    db: Session = Depends(get_project_db_session),
):
    std = crud.update_standard_item_name(
        db, standard_item_id=standard_item_id, new_name=payload.name
    )
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return {"message": "renamed", "standard_item_id": std.id}


@router.post(
    "/project/{project_identifier}/standard-items/",
    response_model=schemas.StandardItem,
    tags=["Project Data"],
)
def create_project_standard_item(
    project_identifier: str,
    item: schemas.StandardItemCreate,
    db: Session = Depends(get_project_db_session),
):
    return crud.create_standard_item(db=db, standard_item=item)


@router.get(
    "/project/{project_identifier}/building-list/",
    response_model=List[schemas.BuildingItem],
    tags=["Project Data"],
)
def read_project_buildings(
    project_identifier: str,
    db: Session = Depends(get_project_db_session),
):
    return crud.list_buildings(db)


@router.post(
    "/project/{project_identifier}/building-list/",
    response_model=schemas.BuildingItem,
    tags=["Project Data"],
)
def create_project_building(
    project_identifier: str,
    building: schemas.BuildingCreate,
    db: Session = Depends(get_project_db_session),
):
    existing = (
        db.query(models.BuildingList)
        .filter(models.BuildingList.name == building.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Building already exists")
    return crud.create_building(db=db, building=building)


@router.get(
    "/project/{project_identifier}/metadata/abbr",
    response_model=schemas.ProjectMetadata,
    tags=["Project Data"],
)
def read_project_metadata(
    project_identifier: str,
):
    try:
        db_path = project_db.resolve_project_db_path(project_identifier)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return project_db.read_project_metadata(db_path)


@router.patch(
    "/project/{project_identifier}/metadata/abbr",
    response_model=schemas.ProjectMetadata,
    tags=["Project Data"],
)
def update_project_metadata(
    project_identifier: str,
    payload: schemas.ProjectMetadata,
):
    try:
        db_path = project_db.resolve_project_db_path(project_identifier)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    updates = payload.model_dump(exclude_unset=True)
    return project_db.update_project_metadata(db_path, updates)


@router.delete(
    "/project/{project_identifier}/building-list/{building_id}",
    tags=["Project Data"],
)
def delete_project_building(
    project_identifier: str,
    building_id: int,
    db: Session = Depends(get_project_db_session),
):
    deleted = crud.delete_building(db=db, building_id=building_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Building not found")
    return {"message": "deleted", "building_id": building_id}


# Get single standard item
@router.get(
    "/standard-items/{standard_item_id}",
    response_model=schemas.StandardItem,
    tags=["Standard Items"],
)
def get_standard_item(standard_item_id: int, db: Session = Depends(get_db)):
    std = crud.get_standard_item(db, standard_item_id=standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return std


# Delete standard item
@router.delete("/standard-items/{standard_item_id}", tags=["Standard Items"])
def delete_standard_item(standard_item_id: int, db: Session = Depends(get_db)):
    std = crud.delete_standard_item(db, standard_item_id=standard_item_id)
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return {"message": "deleted", "standard_item_id": standard_item_id}


# Rename standard item (only name)
@router.post("/standard-items/{standard_item_id}/rename", tags=["Standard Items"])
def rename_standard_item(
    standard_item_id: int,
    payload: schemas.StandardItemRename,
    db: Session = Depends(get_db),
):
    std = crud.update_standard_item_name(
        db, standard_item_id=standard_item_id, new_name=payload.name
    )
    if not std:
        raise HTTPException(status_code=404, detail="StandardItem not found")
    return {"message": "renamed", "standard_item_id": std.id}


@router.get(
    "/family-list/",
    response_model=List[schemas.FamilyListItem],
    tags=["Family List"],
)
def read_family_list(db: Session = Depends(get_db)):
    return crud.list_family_items(db)


@router.post(
    "/family-list/",
    response_model=schemas.FamilyListItem,
    tags=["Family List"],
)
def create_family_list_item(
    item: schemas.FamilyListCreate, db: Session = Depends(get_db)
):
    return crud.create_family_item(db, item)


@router.put(
    "/family-list/{item_id}",
    response_model=schemas.FamilyListItem,
    tags=["Family List"],
)
def update_family_list_item(
    item_id: int, payload: schemas.FamilyListUpdate, db: Session = Depends(get_db)
):
    updated = crud.update_family_item(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return updated


@router.delete("/family-list/{item_id}", tags=["Family List"])
def delete_family_list_item(item_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_family_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return {"message": "deleted", "id": item_id}


@router.get(
    "/family-list/{item_id}/calc-dictionary",
    response_model=List[schemas.CalcDictionaryEntry],
    tags=["Family List"],
)
def read_family_calc_dictionary(item_id: int, db: Session = Depends(get_db)):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.list_calc_dictionary_entries(db, family_item_id=item_id)


@router.post(
    "/family-list/{item_id}/calc-dictionary",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Family List"],
)
def create_family_calc_dictionary_entry(
    item_id: int,
    entry: schemas.CalcDictionaryEntryCreate,
    db: Session = Depends(get_db),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.create_calc_dictionary_entry(db, family_item_id=item_id, entry_in=entry)


@router.patch(
    "/family-list/{item_id}/calc-dictionary/{entry_id}",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Family List"],
)
def update_family_calc_dictionary_entry(
    item_id: int,
    entry_id: int,
    payload: schemas.CalcDictionaryEntryUpdate,
    db: Session = Depends(get_db),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry or entry.family_list_id != item_id:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return entry
    updated = crud.update_calc_dictionary_entry(db, entry_id=entry_id, updates=updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return updated


@router.delete(
    "/family-list/{item_id}/calc-dictionary/{entry_id}",
    tags=["Family List"],
)
def delete_family_calc_dictionary_entry(
    item_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry or entry.family_list_id != item_id:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    deleted = crud.delete_calc_dictionary_entry(db, entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return {"message": "deleted", "id": entry_id}


@router.get(
    "/calc-dictionary",
    response_model=List[schemas.CalcDictionaryEntry],
    tags=["Calc Dictionary"],
)
def read_calc_dictionary_index(db: Session = Depends(get_db)):
    return crud.list_all_calc_dictionary_entries(db)


@router.patch(
    "/calc-dictionary/{entry_id}",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Calc Dictionary"],
)
def update_calc_dictionary_entry(
    entry_id: int,
    payload: schemas.CalcDictionaryEntryUpdate,
    db: Session = Depends(get_db),
):
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return entry
    updated = crud.update_calc_dictionary_entry(db, entry_id=entry_id, updates=updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return updated


@router.post(
    "/calc-dictionary/sync-with-common-input",
    response_model=schemas.CalcDictionarySyncResult,
    tags=["Calc Dictionary"],
)
def sync_calc_dictionary_with_common_input(db: Session = Depends(get_db)):
    updated_entries = crud.sync_calc_dictionary_with_common_inputs(db)
    return schemas.CalcDictionarySyncResult(updated_entries=updated_entries)


@router.get(
    "/project/{project_identifier}/common-input/",
    response_model=List[schemas.CommonInputItem],
    tags=["Project Data"],
)
def list_project_common_input(
    project_identifier: str, db: Session = Depends(get_project_db_session)
):
    return crud.list_common_inputs(db)


@router.post(
    "/project/{project_identifier}/common-input/",
    response_model=schemas.CommonInputItem,
    tags=["Project Data"],
)
def create_project_common_input(
    project_identifier: str,
    payload: schemas.CommonInputCreate,
    db: Session = Depends(get_project_db_session),
):
    try:
        return crud.create_common_input(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put(
    "/project/{project_identifier}/common-input/{item_id}",
    response_model=schemas.CommonInputItem,
    tags=["Project Data"],
)
def update_project_common_input(
    project_identifier: str,
    item_id: int,
    payload: schemas.CommonInputUpdate,
    db: Session = Depends(get_project_db_session),
):
    updated = crud.update_common_input(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="CommonInput item not found")
    return updated


@router.delete(
    "/project/{project_identifier}/common-input/{item_id}",
    tags=["Project Data"],
)
def delete_project_common_input(
    project_identifier: str,
    item_id: int,
    db: Session = Depends(get_project_db_session),
):
    deleted = crud.delete_common_input(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CommonInput item not found")
    return {"message": "deleted", "id": item_id}


@router.get(
    "/project/{project_identifier}/calc-dictionary",
    response_model=List[schemas.CalcDictionaryEntry],
    tags=["Project Data"],
)
def read_project_calc_dictionary(
    project_identifier: str, db: Session = Depends(get_project_db_session)
):
    return crud.list_all_calc_dictionary_entries(db)


@router.post(
    "/project/{project_identifier}/calc-dictionary",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Project Data"],
)
def create_project_calc_dictionary_entry(
    project_identifier: str,
    payload: schemas.ProjectCalcDictionaryEntryCreate,
    db: Session = Depends(get_project_db_session),
):
    family_id = payload.family_list_id
    if family_id is not None:
        family_item = crud.get_family_item(db, family_id)
        if not family_item:
            raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.create_project_calc_dictionary_entry(db, payload)


@router.patch(
    "/project/{project_identifier}/calc-dictionary/{entry_id}",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Project Data"],
)
def update_project_calc_dictionary_entry(
    project_identifier: str,
    entry_id: int,
    payload: schemas.CalcDictionaryEntryUpdate,
    db: Session = Depends(get_project_db_session),
):
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return entry
    updated = crud.update_calc_dictionary_entry(db, entry_id=entry_id, updates=updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return updated


@router.delete(
    "/project/{project_identifier}/calc-dictionary/{entry_id}",
    tags=["Project Data"],
)
def delete_project_calc_dictionary_entry(
    project_identifier: str,
    entry_id: int,
    db: Session = Depends(get_project_db_session),
):
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    updated = crud.update_calc_dictionary_entry(
        db, entry_id=entry_id, updates={"is_deleted": 1}
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return {"message": "deleted", "id": entry_id}


@router.post(
    "/project/{project_identifier}/calc-dictionary/sync-with-common-input",
    response_model=schemas.CalcDictionarySyncResult,
    tags=["Project Data"],
)
def sync_project_calc_dictionary_with_common_input(
    project_identifier: str, db: Session = Depends(get_project_db_session)
):
    updated_entries = crud.sync_calc_dictionary_with_common_inputs(db)
    return schemas.CalcDictionarySyncResult(updated_entries=updated_entries)


@router.get(
    "/family-list/{item_id}/assignments",
    response_model=List[schemas.GwmFamilyAssign],
    tags=["Family List"],
)
def read_family_assignments(item_id: int, db: Session = Depends(get_db)):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.list_gwm_family_assignments(db, family_id=item_id)


@router.post(
    "/family-list/{item_id}/assignments",
    response_model=List[schemas.GwmFamilyAssign],
    tags=["Family List"],
)
def replace_family_assignments(
    item_id: int,
    payload: schemas.GwmFamilyAssignmentPayload,
    db: Session = Depends(get_db),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.replace_gwm_family_assignments(
        db, family_id=item_id, standard_item_ids=payload.standard_item_ids
    )


@router.patch(
    "/family-list/{item_id}/assignments/{assignment_id}",
    response_model=schemas.GwmFamilyAssign,
    tags=["Family List"],
)
def update_family_assignment_metadata(
    item_id: int,
    assignment_id: int,
    payload: schemas.GwmFamilyAssignUpdate,
    db: Session = Depends(get_db),
):
    updated = crud.update_gwm_family_assignment(
        db,
        family_id=item_id,
        assignment_id=assignment_id,
        updates=payload.model_dump(exclude_unset=True),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return updated


@router.post(
    "/family-list/{item_id}/assignments/{standard_item_id}",
    response_model=schemas.GwmFamilyAssign,
    tags=["Family List"],
)
def create_family_assignment(
    item_id: int,
    standard_item_id: int,
    db: Session = Depends(get_db),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    assignment = crud.create_gwm_family_assignment(
        db, family_id=item_id, standard_item_id=standard_item_id
    )
    return assignment


@router.get(
    "/project/{project_identifier}/family-list/",
    response_model=List[schemas.FamilyListItem],
    tags=["Project Data"],
)
def read_project_family_list(
    project_identifier: str, db: Session = Depends(get_project_db_session)
):
    return crud.list_family_items(db)


@router.post(
    "/project/{project_identifier}/family-list/",
    response_model=schemas.FamilyListItem,
    tags=["Project Data"],
)
def create_project_family_list_item(
    project_identifier: str,
    item: schemas.FamilyListCreate,
    db: Session = Depends(get_project_db_session),
):
    return crud.create_family_item(db, item)


@router.put(
    "/project/{project_identifier}/family-list/{item_id}",
    response_model=schemas.FamilyListItem,
    tags=["Project Data"],
)
def update_project_family_list_item(
    project_identifier: str,
    item_id: int,
    payload: schemas.FamilyListUpdate,
    db: Session = Depends(get_project_db_session),
):
    updated = crud.update_family_item(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return updated


@router.delete(
    "/project/{project_identifier}/family-list/{item_id}", tags=["Project Data"]
)
def delete_project_family_list_item(
    project_identifier: str, item_id: int, db: Session = Depends(get_project_db_session)
):
    deleted = crud.delete_family_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return {"message": "deleted", "id": item_id}


@router.get(
    "/project/{project_identifier}/family-list/{item_id}/calc-dictionary",
    response_model=List[schemas.CalcDictionaryEntry],
    tags=["Project Data"],
)
def read_project_family_calc_dictionary(
    project_identifier: str,
    item_id: int,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.list_calc_dictionary_entries(db, family_item_id=item_id)


@router.post(
    "/project/{project_identifier}/family-list/{item_id}/calc-dictionary",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Project Data"],
)
def create_project_family_calc_dictionary_entry(
    project_identifier: str,
    item_id: int,
    entry: schemas.CalcDictionaryEntryCreate,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.create_calc_dictionary_entry(db, family_item_id=item_id, entry_in=entry)


@router.patch(
    "/project/{project_identifier}/family-list/{item_id}/calc-dictionary/{entry_id}",
    response_model=schemas.CalcDictionaryEntry,
    tags=["Project Data"],
)
def update_project_family_calc_dictionary_entry(
    project_identifier: str,
    item_id: int,
    entry_id: int,
    payload: schemas.CalcDictionaryEntryUpdate,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry or entry.family_list_id != item_id:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return entry
    updated = crud.update_calc_dictionary_entry(db, entry_id=entry_id, updates=updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return updated


@router.delete(
    "/project/{project_identifier}/family-list/{item_id}/calc-dictionary/{entry_id}",
    tags=["Project Data"],
)
def delete_project_family_calc_dictionary_entry(
    project_identifier: str,
    item_id: int,
    entry_id: int,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    entry = crud.get_calc_dictionary_entry(db, entry_id)
    if not entry or entry.family_list_id != item_id:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    deleted = crud.delete_calc_dictionary_entry(db, entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Calc dictionary entry not found")
    return {"message": "deleted", "id": entry_id}


@router.get(
    "/project/{project_identifier}/family-list/{item_id}/revit-types",
    response_model=List[schemas.FamilyRevitType],
    tags=["Project Data"],
)
def read_project_family_revit_types(
    project_identifier: str,
    item_id: int,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.list_family_revit_types(db, family_item_id=item_id)


@router.post(
    "/project/{project_identifier}/family-list/{item_id}/revit-types",
    response_model=List[schemas.FamilyRevitType],
    tags=["Project Data"],
)
def replace_project_family_revit_types(
    project_identifier: str,
    item_id: int,
    payload: schemas.FamilyRevitTypeListPayload,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    entries = payload.entries
    if not entries:
        entries = [{"type_name": name} for name in payload.type_names]
    return crud.replace_family_revit_types(db, family_item_id=item_id, entries=entries)


@router.get(
    "/project/{project_identifier}/family-list/{item_id}/assignments",
    response_model=List[schemas.GwmFamilyAssign],
    tags=["Project Data"],
)
def read_project_family_assignments(
    project_identifier: str, item_id: int, db: Session = Depends(get_project_db_session)
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.list_gwm_family_assignments(db, family_id=item_id)


@router.post(
    "/project/{project_identifier}/family-list/{item_id}/assignments",
    response_model=List[schemas.GwmFamilyAssign],
    tags=["Project Data"],
)
def replace_project_family_assignments(
    project_identifier: str,
    item_id: int,
    payload: schemas.GwmFamilyAssignmentPayload,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    return crud.replace_gwm_family_assignments(
        db, family_id=item_id, standard_item_ids=payload.standard_item_ids
    )


@router.patch(
    "/project/{project_identifier}/family-list/{item_id}/assignments/{assignment_id}",
    response_model=schemas.GwmFamilyAssign,
    tags=["Project Data"],
)
def update_project_family_assignment_metadata(
    project_identifier: str,
    item_id: int,
    assignment_id: int,
    payload: schemas.GwmFamilyAssignUpdate,
    db: Session = Depends(get_project_db_session),
):
    updated = crud.update_gwm_family_assignment(
        db,
        family_id=item_id,
        assignment_id=assignment_id,
        updates=payload.model_dump(exclude_unset=True),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return updated


@router.post(
    "/project/{project_identifier}/family-list/{item_id}/assignments/{standard_item_id}",
    response_model=schemas.GwmFamilyAssign,
    tags=["Project Data"],
)
def create_project_family_assignment(
    project_identifier: str,
    item_id: int,
    standard_item_id: int,
    db: Session = Depends(get_project_db_session),
):
    family_item = crud.get_family_item(db, item_id)
    if not family_item:
        raise HTTPException(status_code=404, detail="FamilyList item not found")
    assignment = crud.create_gwm_family_assignment(
        db, family_id=item_id, standard_item_id=standard_item_id
    )
    return assignment


@router.get(
    "/project-db/",
    response_model=List[schemas.ProjectDbItem],
    tags=["Project DB"],
)
def list_project_databases():
    return project_db.list_project_dbs()


@router.post(
    "/project-db/",
    response_model=schemas.ProjectDbItem,
    tags=["Project DB"],
)
def create_project_database(payload: schemas.ProjectDbCreate):
    try:
        return project_db.create_project_db(payload.display_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/project-db/{file_name}/copy",
    response_model=schemas.ProjectDbItem,
    tags=["Project DB"],
)
def copy_project_database(file_name: str, payload: schemas.ProjectDbCopy):
    try:
        return project_db.copy_project_db(file_name, payload.display_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/project-db/{file_name}/rename",
    response_model=schemas.ProjectDbItem,
    tags=["Project DB"],
)
def rename_project_database(file_name: str, payload: schemas.ProjectDbRename):
    try:
        return project_db.rename_project_db(file_name, payload.new_display_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/project-db/{file_name}", tags=["Project DB"])
def delete_project_database(file_name: str, admin_key: str):
    if admin_key != project_db.ADMIN_KEY:
        raise HTTPException(
            status_code=403, detail="Admin key is required for deletion"
        )
    try:
        project_db.delete_project_db(file_name)
        return {"message": "deleted", "file_name": file_name}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get(
    "/common-input/",
    response_model=List[schemas.CommonInputItem],
    tags=["Common Input"],
)
def list_common_input(db: Session = Depends(get_db)):
    return crud.list_common_inputs(db)


@router.post(
    "/common-input/",
    response_model=schemas.CommonInputItem,
    tags=["Common Input"],
)
def create_common_input(
    payload: schemas.CommonInputCreate, db: Session = Depends(get_db)
):
    try:
        return crud.create_common_input(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put(
    "/common-input/{item_id}",
    response_model=schemas.CommonInputItem,
    tags=["Common Input"],
)
def update_common_input(
    item_id: int, payload: schemas.CommonInputUpdate, db: Session = Depends(get_db)
):
    updated = crud.update_common_input(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="CommonInput item not found")
    return updated


@router.delete("/common-input/{item_id}", tags=["Common Input"])
def delete_common_input(item_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_common_input(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CommonInput item not found")
    return {"message": "deleted", "id": item_id}


@router.options("/{path:path}")
def cors_options(path: str):
    return Response(status_code=204)

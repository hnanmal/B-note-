from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Response
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from typing import List, Optional
import pandas as pd
import io
import json
import datetime

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

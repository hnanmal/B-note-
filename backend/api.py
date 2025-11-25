from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io

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


# Create standard item
@router.post(
    "/standard-items/", response_model=schemas.StandardItem, tags=["Standard Items"]
)
def create_standard_item(
    item: schemas.StandardItemCreate, db: Session = Depends(get_db)
):
    return crud.create_standard_item(db=db, standard_item=item)


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

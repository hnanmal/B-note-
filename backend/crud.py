from sqlalchemy.orm import Session
from sqlalchemy import or_
import models, schemas
import security


def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()


def get_projects_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Project)
        .filter(models.Project.owner_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_user_project(db: Session, project: schemas.ProjectCreate, user_id: int):
    db_project = models.Project(**project.dict(), owner_id=user_id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


# ===================
#        User
# ===================
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(
        email=user.email, username=user.username, hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# ===================
#     WorkMaster
# ===================


def get_work_master_by_work_master_code(db: Session, code: str):
    return (
        db.query(models.WorkMaster)
        .filter(models.WorkMaster.work_master_code == code)
        .first()
    )


def create_work_master(db: Session, work_master: schemas.WorkMasterCreate):
    db_work_master = models.WorkMaster(**work_master.dict())
    db.add(db_work_master)
    db.commit()
    db.refresh(db_work_master)
    return db_work_master


def update_work_master(
    db: Session,
    db_work_master: models.WorkMaster,
    work_master_in: schemas.WorkMasterCreate,
):
    update_data = work_master_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_work_master, key, value)
    db.add(db_work_master)
    db.commit()
    db.refresh(db_work_master)
    return db_work_master


def get_work_masters(db: Session, skip: int = 0, limit: int = None, search: str = None):
    query = db.query(models.WorkMaster)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.WorkMaster.discipline.ilike(search_term),
                models.WorkMaster.cat_large_code.ilike(search_term),
                models.WorkMaster.cat_large_desc.ilike(search_term),
                models.WorkMaster.cat_mid_code.ilike(search_term),
                models.WorkMaster.cat_mid_desc.ilike(search_term),
                models.WorkMaster.cat_small_code.ilike(search_term),
                models.WorkMaster.cat_small_desc.ilike(search_term),
                models.WorkMaster.attr1_code.ilike(search_term),
                models.WorkMaster.attr1_spec.ilike(search_term),
                models.WorkMaster.attr2_code.ilike(search_term),
                models.WorkMaster.attr2_spec.ilike(search_term),
                models.WorkMaster.attr3_code.ilike(search_term),
                models.WorkMaster.attr3_spec.ilike(search_term),
                models.WorkMaster.work_master_code.ilike(search_term),
            )
        )

    if skip is not None:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)

    return query.all()

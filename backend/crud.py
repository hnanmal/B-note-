from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from . import models, schemas
from . import security


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


# ===================
#   StandardItem
# ===================
def get_standard_items(
    db: Session,
    skip: int = 0,
    limit: int = None,
    search: str = None,
    parent_id: int = None,
):
    query = db.query(models.StandardItem)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.StandardItem.name.ilike(search_term),
            )
        )

    # filter by parent_id when provided (return only direct children)
    if parent_id is not None:
        query = query.filter(models.StandardItem.parent_id == parent_id)

    if skip is not None:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)

    return query.all()


def create_standard_item(db: Session, standard_item: schemas.StandardItemCreate):
    db_item = models.StandardItem(**standard_item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_standard_item(db: Session, standard_item_id: int):
    item = get_standard_item(db, standard_item_id)
    if not item:
        return None
    db.delete(item)
    db.commit()
    return item


def _normalize_family_sequence(item: Optional[models.FamilyListItem]):
    if item is None:
        return None
    if item.sequence_number is not None:
        item.sequence_number = str(item.sequence_number)
    return item


def list_family_items(db: Session):
    items = db.query(models.FamilyListItem).order_by(models.FamilyListItem.name).all()
    return [_normalize_family_sequence(item) for item in items]


def get_family_item(db: Session, item_id: int):
    item = (
        db.query(models.FamilyListItem)
        .filter(models.FamilyListItem.id == item_id)
        .first()
    )
    return _normalize_family_sequence(item)


def create_family_item(db: Session, family_item: schemas.FamilyListCreate):
    db_item = models.FamilyListItem(**family_item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return _normalize_family_sequence(db_item)


def update_family_item(db: Session, item_id: int, updates: schemas.FamilyListUpdate):
    db_item = get_family_item(db, item_id)
    if not db_item:
        return None
    data = updates.dict(exclude_none=True)
    for key, value in data.items():
        setattr(db_item, key, value)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return _normalize_family_sequence(db_item)


def delete_family_item(db: Session, item_id: int):
    item = get_family_item(db, item_id)
    if not item:
        return None
    db.delete(item)
    db.commit()
    return item


def list_calc_dictionary_entries(db: Session, family_item_id: int):
    return (
        db.query(models.CalcDictionaryEntry)
        .filter(models.CalcDictionaryEntry.family_list_id == family_item_id)
        .order_by(models.CalcDictionaryEntry.symbol_key)
        .all()
    )


def create_calc_dictionary_entry(
    db: Session, family_item_id: int, entry_in: schemas.CalcDictionaryEntryCreate
):
    db_entry = models.CalcDictionaryEntry(
        family_list_id=family_item_id,
        calc_code=entry_in.calc_code,
        symbol_key=entry_in.symbol_key,
        symbol_value=entry_in.symbol_value,
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


def get_calc_dictionary_entry(db: Session, entry_id: int):
    return (
        db.query(models.CalcDictionaryEntry)
        .filter(models.CalcDictionaryEntry.id == entry_id)
        .first()
    )


def update_calc_dictionary_entry(db: Session, entry_id: int, updates: dict):
    entry = get_calc_dictionary_entry(db, entry_id)
    if not entry:
        return None
    for key, value in updates.items():
        if hasattr(entry, key):
            setattr(entry, key, value)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_calc_dictionary_entry(db: Session, entry_id: int):
    entry = get_calc_dictionary_entry(db, entry_id)
    if not entry:
        return None
    db.delete(entry)
    db.commit()
    return entry


def get_standard_item(db: Session, standard_item_id: int):
    return (
        db.query(models.StandardItem)
        .filter(models.StandardItem.id == standard_item_id)
        .first()
    )


def _collect_standard_item_tree_ids(db: Session, roots: List[int]):
    collected: set[int] = set()
    stack = [int(r) for r in roots if r is not None]
    while stack:
        current = stack.pop()
        if current in collected:
            continue
        collected.add(current)
        children = (
            db.query(models.StandardItem.id)
            .filter(models.StandardItem.parent_id == current)
            .all()
        )
        for (child_id,) in children:
            if child_id not in collected:
                stack.append(child_id)
    return collected


def list_gwm_family_assignments(db: Session, family_id: int):
    return (
        db.query(models.GwmFamilyAssign)
        .filter(models.GwmFamilyAssign.family_list_id == family_id)
        .all()
    )


def replace_gwm_family_assignments(
    db: Session, family_id: int, standard_item_ids: List[int]
):
    import datetime

    root_ids = [int(i) for i in set(standard_item_ids or []) if i is not None]
    expanded_ids = _collect_standard_item_tree_ids(db, root_ids) if root_ids else set()

    (
        db.query(models.GwmFamilyAssign)
        .filter(models.GwmFamilyAssign.family_list_id == family_id)
        .delete(synchronize_session=False)
    )

    if not expanded_ids:
        db.commit()
        return []

    now = datetime.datetime.utcnow()
    assignments = [
        models.GwmFamilyAssign(
            family_list_id=family_id,
            standard_item_id=std_id,
            assigned_at=now,
            created_at=now,
        )
        for std_id in expanded_ids
    ]
    db.bulk_save_objects(assignments)
    db.commit()
    return list_gwm_family_assignments(db, family_id=family_id)


def update_gwm_family_assignment(
    db: Session, family_id: int, assignment_id: int, updates: dict
):
    assignment = (
        db.query(models.GwmFamilyAssign)
        .filter(models.GwmFamilyAssign.family_list_id == family_id)
        .filter(models.GwmFamilyAssign.id == assignment_id)
        .first()
    )
    if not assignment:
        return None

    if "formula" in updates:
        assignment.formula = updates["formula"]
    if "description" in updates:
        assignment.description = updates["description"]

    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def assign_work_master_to_standard_item(
    db: Session, standard_item_id: int, work_master_id: int
):
    std = get_standard_item(db, standard_item_id)
    if not std:
        return None
    wm = (
        db.query(models.WorkMaster)
        .filter(models.WorkMaster.id == work_master_id)
        .first()
    )
    if not wm:
        return None

    # Avoid duplicate
    if wm not in std.work_masters:
        std.work_masters.append(wm)
        db.add(std)
        db.commit()
        db.refresh(std)

    return std


def remove_work_master_from_standard_item(
    db: Session, standard_item_id: int, work_master_id: int
):
    std = get_standard_item(db, standard_item_id)
    if not std:
        return None
    wm = (
        db.query(models.WorkMaster)
        .filter(models.WorkMaster.id == work_master_id)
        .first()
    )
    if not wm:
        return None

    if wm in std.work_masters:
        std.work_masters.remove(wm)
        db.add(std)
        db.commit()
        db.refresh(std)

    return std


def update_standard_item_name(db: Session, standard_item_id: int, new_name: str):
    item = get_standard_item(db, standard_item_id)
    if not item:
        return None
    item.name = new_name
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_common_inputs(db: Session):
    return (
        db.query(models.CommonInput)
        .order_by(models.CommonInput.classification, models.CommonInput.abbreviation)
        .all()
    )


def get_common_input(db: Session, item_id: int):
    return db.query(models.CommonInput).filter(models.CommonInput.id == item_id).first()


def create_common_input(db: Session, item: schemas.CommonInputCreate):
    if not item.classification.strip():
        raise ValueError("분류를 입력해주세요.")
    db_item = models.CommonInput(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_common_input(db: Session, item_id: int, updates: schemas.CommonInputUpdate):
    db_item = get_common_input(db, item_id)
    if not db_item:
        return None
    data = updates.dict(exclude_none=True)
    for key, value in data.items():
        setattr(db_item, key, value)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_common_input(db: Session, item_id: int):
    item = get_common_input(db, item_id)
    if not item:
        return None
    db.delete(item)
    db.commit()
    return item

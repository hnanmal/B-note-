from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, delete
from typing import Optional, List, Dict, Any
from string import ascii_uppercase
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

def get_work_master(db: Session, work_master_id: int):
    return db.query(models.WorkMaster).filter(models.WorkMaster.id == work_master_id).first()

def _next_available_gauge(used: set[str]) -> Optional[str]:
    for letter in ascii_uppercase:
        if letter not in used:
            return letter
    return None

_WORK_MASTER_COPY_COLUMNS = [
    column.name
    for column in models.WorkMaster.__table__.columns
    if column.name != 'id'
]

def update_work_master_fields(
    db: Session,
    db_work_master: models.WorkMaster,
    updates: Dict[str, Any],
):
    for key, value in updates.items():
        if hasattr(db_work_master, key):
            setattr(db_work_master, key, value)
    db.add(db_work_master)
    db.commit()
    db.refresh(db_work_master)
    return db_work_master


def create_work_master(db: Session, work_master: schemas.WorkMasterCreate):
    db_work_master = models.WorkMaster(**work_master.dict())
    db.add(db_work_master)
    db.commit()
    db.refresh(db_work_master)
    return db_work_master

def duplicate_work_master_with_gauge(db: Session, work_master_id: int):
    work_master = get_work_master(db, work_master_id)
    if not work_master:
        return None

    base_code = work_master.work_master_code
    if not base_code:
        raise ValueError('유효한 WorkMaster 코드를 찾을 수 없습니다.')

    related = (
        db.query(models.WorkMaster)
        .filter(models.WorkMaster.work_master_code == base_code)
        .all()
    )

    assigned_letters: set[str] = set()
    for entry in related:
        letter = (entry.gauge or '').strip().upper()
        if len(letter) == 1 and letter in ascii_uppercase:
            assigned_letters.add(letter)

    if not work_master.gauge or not isinstance(work_master.gauge, str):
        available = _next_available_gauge(assigned_letters)
        if not available:
            raise ValueError('더 이상 게이지를 추가할 수 없습니다.')
        work_master.gauge = available
        assigned_letters.add(available)
    else:
        assigned_letters.add(work_master.gauge.strip().upper())

    next_letter = _next_available_gauge(assigned_letters)
    if not next_letter:
        raise ValueError('더 이상 게이지를 추가할 수 없습니다.')

    copy_attrs = {column: getattr(work_master, column) for column in _WORK_MASTER_COPY_COLUMNS}
    copy_attrs['work_master_code'] = base_code
    copy_attrs['gauge'] = next_letter
    new_work_master = models.WorkMaster(**copy_attrs)
    db.add(work_master)
    db.add(new_work_master)

    for standard_item in list(work_master.standard_items):
        if new_work_master not in standard_item.work_masters:
            standard_item.work_masters.append(new_work_master)
            db.add(standard_item)

    db.commit()
    db.refresh(work_master)
    db.refresh(new_work_master)
    return new_work_master

def remove_work_master_gauge(db: Session, work_master_id: int):
    work_master = get_work_master(db, work_master_id)
    if not work_master:
        return None

    code = work_master.work_master_code
    if not code:
        raise ValueError('유효한 WorkMaster 코드를 찾을 수 없습니다.')

    db.execute(
        delete(models.StandardItemWorkMasterSelect).where(
            models.StandardItemWorkMasterSelect.work_master_id == work_master_id
        )
    )
    db.execute(
        models.standard_item_work_master_association.delete().where(
            models.standard_item_work_master_association.c.work_master_id == work_master_id
        )
    )
    db.delete(work_master)

    remaining = (
        db.query(models.WorkMaster)
        .filter(models.WorkMaster.work_master_code == code)
        .all()
    )
    remaining = [entry for entry in remaining if entry.id != work_master_id]
    if not remaining:
        db.commit()
        return []

    def gauge_sort_key(entry: models.WorkMaster):
        gauge_str = (entry.gauge or '').strip()
        return (gauge_str == '', gauge_str)

    sorted_remaining = sorted(remaining, key=gauge_sort_key)
    if len(sorted_remaining) <= 1:
        for entry in sorted_remaining:
            entry.gauge = None
            db.add(entry)
    else:
        for idx, entry in enumerate(sorted_remaining):
            letter = ascii_uppercase[idx] if idx < len(ascii_uppercase) else None
            entry.gauge = letter
            db.add(entry)

    db.commit()
    for entry in sorted_remaining:
        db.refresh(entry)
    return sorted_remaining


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
    query = db.query(models.StandardItem).options(
        joinedload(models.StandardItem.selected_work_master_assoc)
    )

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

    items = query.all()
    for item in items:
        _attach_standard_item_selection(item)
    return items

def _attach_standard_item_selection(item: Optional[models.StandardItem]):
    if not item:
        return item
    assoc = getattr(item, 'selected_work_master_assoc', None)
    item.selected_work_master_id = assoc.work_master_id if assoc else None
    return item


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


def _normalize_sequence_value(value: Optional[str]):
    if value is None:
        return None
    trimmed = str(value).strip()
    return trimmed if trimmed else None


def _sync_family_calc_codes_on_sequence_change(
    db: Session, family_item_id: int, old_sequence: Optional[str], new_sequence: Optional[str]
):
    if not old_sequence or old_sequence == new_sequence:
        return
    (
        db.query(models.CalcDictionaryEntry)
        .filter(
            models.CalcDictionaryEntry.family_list_id == family_item_id,
            models.CalcDictionaryEntry.calc_code == old_sequence,
        )
        .update({'calc_code': new_sequence}, synchronize_session=False)
    )


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
    old_sequence = _normalize_sequence_value(db_item.sequence_number)
    data = updates.dict(exclude_none=True)
    sequence_is_modified = 'sequence_number' in data
    for key, value in data.items():
        setattr(db_item, key, value)
    new_sequence = _normalize_sequence_value(db_item.sequence_number) if sequence_is_modified else old_sequence
    if sequence_is_modified:
        _sync_family_calc_codes_on_sequence_change(db, item_id, old_sequence, new_sequence)
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


def list_family_revit_types(db: Session, family_item_id: int):
    return (
        db.query(models.FamilyRevitType)
        .filter(models.FamilyRevitType.family_list_id == family_item_id)
        .order_by(models.FamilyRevitType.id)
        .all()
    )


def replace_family_revit_types(db: Session, family_item_id: int, type_names: List[str]):
    normalized_names = [name.strip() for name in type_names if name and name.strip()]
    (
        db.query(models.FamilyRevitType)
        .filter(models.FamilyRevitType.family_list_id == family_item_id)
        .delete(synchronize_session=False)
    )
    created_entries: List[models.FamilyRevitType] = []
    for name in normalized_names:
        entry = models.FamilyRevitType(family_list_id=family_item_id, type_name=name)
        db.add(entry)
        created_entries.append(entry)
    if created_entries:
        db.flush()
    db.commit()
    if created_entries:
        for entry in created_entries:
            db.refresh(entry)
    return (
        db.query(models.FamilyRevitType)
        .filter(models.FamilyRevitType.family_list_id == family_item_id)
        .order_by(models.FamilyRevitType.id)
        .all()
    )


def list_all_calc_dictionary_entries(db: Session):
    return (
        db.query(models.CalcDictionaryEntry)
        .options(joinedload(models.CalcDictionaryEntry.family_list_item))
        .order_by(models.CalcDictionaryEntry.created_at.desc())
        .all()
    )


def _normalize_sync_key(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = str(value).strip()
    return trimmed.lower() if trimmed else None


def sync_calc_dictionary_with_common_inputs(db: Session) -> int:
    common_inputs = list_common_inputs(db)
    key_to_value: Dict[str, Optional[str]] = {}

    for input_item in common_inputs:
        abbreviation_key = _normalize_sync_key(input_item.abbreviation)
        classification_key = _normalize_sync_key(input_item.classification)
        selected_key = abbreviation_key or classification_key
        if not selected_key:
            continue
        key_to_value[selected_key] = input_item.input_value

    if not key_to_value:
        return 0

    entries = (
        db.query(models.CalcDictionaryEntry)
        .filter(models.CalcDictionaryEntry.symbol_key.isnot(None))
        .all()
    )
    updated = 0
    for entry in entries:
        entry_key = _normalize_sync_key(entry.symbol_key)
        if not entry_key:
            continue
        if entry_key not in key_to_value:
            continue
        new_value = key_to_value[entry_key]
        normalized_value = str(new_value).strip() if new_value is not None else None
        if entry.symbol_value == normalized_value:
            continue
        entry.symbol_value = normalized_value
        updated += 1
        db.add(entry)

    if updated:
        db.commit()
    return updated


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
    item = (
        db.query(models.StandardItem)
        .options(joinedload(models.StandardItem.selected_work_master_assoc))
        .filter(models.StandardItem.id == standard_item_id)
        .first()
    )
    _attach_standard_item_selection(item)
    return item


def select_work_master_for_standard_item(
    db: Session,
    standard_item_id: int,
    work_master_id: Optional[int],
):
    item = get_standard_item(db, standard_item_id)
    if not item:
        return None
    selection = (
        db.query(models.StandardItemWorkMasterSelect)
        .filter(models.StandardItemWorkMasterSelect.standard_item_id == standard_item_id)
        .first()
    )
    if work_master_id is None:
        if selection:
            db.delete(selection)
            db.commit()
        return None
    if selection:
        selection.work_master_id = work_master_id
        db.add(selection)
    else:
        selection = models.StandardItemWorkMasterSelect(
            standard_item_id=standard_item_id,
            work_master_id=work_master_id,
        )
        db.add(selection)
    db.commit()
    db.refresh(selection)
    return selection


def list_buildings(db: Session):
    return db.query(models.BuildingList).order_by(models.BuildingList.name).all()


def create_building(db: Session, building: schemas.BuildingCreate):
    db_building = models.BuildingList(**building.dict())
    db.add(db_building)
    db.commit()
    db.refresh(db_building)
    return db_building


def delete_building(db: Session, building_id: int):
    building = db.query(models.BuildingList).filter(models.BuildingList.id == building_id).first()
    if not building:
        return None
    db.delete(building)
    db.commit()
    return building


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

def create_gwm_family_assignment(
    db: Session, family_id: int, standard_item_id: int
):
    existing = (
        db.query(models.GwmFamilyAssign)
        .filter(
            models.GwmFamilyAssign.family_list_id == family_id,
            models.GwmFamilyAssign.standard_item_id == standard_item_id,
        )
        .first()
    )
    if existing:
        return existing
    assignment = models.GwmFamilyAssign(
        family_list_id=family_id,
        standard_item_id=standard_item_id,
        formula=None,
        description=None,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


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

    existing_metadata = {}
    if expanded_ids:
        current_assignments = list_gwm_family_assignments(db, family_id=family_id)
        existing_metadata = {
            assignment.standard_item_id: {
                'formula': assignment.formula,
                'description': assignment.description,
            }
            for assignment in current_assignments
        }

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
            formula=existing_metadata.get(std_id, {}).get('formula'),
            description=existing_metadata.get(std_id, {}).get('description'),
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

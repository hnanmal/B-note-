from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
import datetime

from .models import StandardItemType


# Forward declarations for circular references
class _StandardItemWithoutRelations(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: StandardItemType
    parent_id: Optional[int] = None


class _ProjectWithoutOwner(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_name: str
    project_code: str
    description: Optional[str] = None
    creation_date: datetime.datetime
    owner_id: int


# WorkMaster Schemas
class WorkMasterBase(BaseModel):
    discipline: Optional[str] = None
    cat_large_code: Optional[str] = None
    cat_large_desc: Optional[str] = None
    cat_mid_code: Optional[str] = None
    cat_mid_desc: Optional[str] = None
    cat_small_code: Optional[str] = None
    cat_small_desc: Optional[str] = None
    attr1_code: Optional[str] = None
    attr1_spec: Optional[str] = None
    attr2_code: Optional[str] = None
    attr2_spec: Optional[str] = None
    attr3_code: Optional[str] = None
    attr3_spec: Optional[str] = None
    attr4_code: Optional[str] = None
    attr4_spec: Optional[str] = None
    attr5_code: Optional[str] = None
    attr5_spec: Optional[str] = None
    attr6_code: Optional[str] = None
    attr6_spec: Optional[str] = None
    uom1: Optional[str] = None
    uom2: Optional[str] = None
    work_group_code: Optional[str] = None
    work_master_code: str
    new_old_code: Optional[str] = None


class WorkMasterCreate(WorkMasterBase):
    pass


class WorkMaster(WorkMasterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    standard_items: List[_StandardItemWithoutRelations] = []


# StandardItem Schemas
class StandardItemBase(BaseModel):
    name: str
    type: StandardItemType
    parent_id: Optional[int] = None


class StandardItemCreate(StandardItemBase):
    pass


class AssignWorkMaster(BaseModel):
    work_master_id: int


class StandardItemRename(BaseModel):
    name: str


class StandardItem(StandardItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # avoid recursive nesting by using the lightweight _StandardItemWithoutRelations
    parent: Optional[_StandardItemWithoutRelations] = None
    children: List[_StandardItemWithoutRelations] = []
    work_masters: List[WorkMaster] = []


class _FamilyListWithoutRelations(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    item_type: str
    parent_id: Optional[int] = None


class FamilyListBase(BaseModel):
    name: str
    item_type: str
    parent_id: Optional[int] = None
    sequence_number: Optional[str] = None
    description: Optional[str] = None


class FamilyListCreate(FamilyListBase):
    pass


class FamilyListUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = None
    item_type: Optional[str] = None
    parent_id: Optional[int] = None
    sequence_number: Optional[str] = None
    description: Optional[str] = None


class FamilyListItem(FamilyListBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    children: List[_FamilyListWithoutRelations] = []
    revit_types: List["FamilyRevitType"] = []


class CalcDictionaryEntryBase(BaseModel):
    calc_code: Optional[str] = None
    symbol_key: str
    symbol_value: str


class CalcDictionaryEntryCreate(CalcDictionaryEntryBase):
    pass


class CalcDictionaryEntryUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    calc_code: Optional[str] = None
    symbol_key: Optional[str] = None
    symbol_value: Optional[str] = None


class CalcDictionaryEntry(CalcDictionaryEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    family_list_id: int
    created_at: datetime.datetime
    family_item: Optional[_FamilyListWithoutRelations] = None


class FamilyRevitTypeBase(BaseModel):
    type_name: str


class FamilyRevitTypeCreate(FamilyRevitTypeBase):
    pass


class FamilyRevitType(FamilyRevitTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    family_list_id: int
    created_at: datetime.datetime


class FamilyRevitTypeListPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type_names: List[str] = Field(default_factory=list)


class CalcDictionarySyncResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    updated_entries: int


class GwmFamilyAssignmentPayload(BaseModel):
    standard_item_ids: List[int] = Field(default_factory=list)


class GwmFamilyAssignBase(BaseModel):
    family_list_id: int
    standard_item_id: int
    formula: Optional[str] = None
    description: Optional[str] = None


class GwmFamilyAssign(GwmFamilyAssignBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assigned_at: datetime.datetime
    formula: Optional[str] = None
    description: Optional[str] = None
    standard_item: Optional[_StandardItemWithoutRelations] = None


class GwmFamilyAssignUpdate(BaseModel):
    formula: Optional[str] = None
    description: Optional[str] = None


# Project Schemas
class ProjectBase(BaseModel):
    project_name: str
    project_code: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creation_date: datetime.datetime
    owner_id: int
    owner: "UserWithoutProjects"


# User Schemas
class UserBase(BaseModel):
    email: str
    username: Optional[str] = None


class UserCreate(UserBase):
    password: str


class User(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    projects: List[_ProjectWithoutOwner] = []


class UserWithoutProjects(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ProjectDbBase(BaseModel):
    display_name: str


class ProjectDbCreate(ProjectDbBase):
    pass


class ProjectDbCopy(BaseModel):
    display_name: Optional[str] = None


class ProjectDbRename(BaseModel):
    new_display_name: str


class ProjectDbItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_name: str
    display_name: str
    created_at: str
    size: int


class CommonInputBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    classification: str
    abbreviation: Optional[str] = None
    description: Optional[str] = None
    input_value: Optional[str] = None
    unit: Optional[str] = None
    remark: Optional[str] = None


class CommonInputCreate(CommonInputBase):
    pass


class CommonInputUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    classification: Optional[str] = None
    abbreviation: Optional[str] = None
    description: Optional[str] = None
    input_value: Optional[str] = None
    unit: Optional[str] = None
    remark: Optional[str] = None


class CommonInputItem(CommonInputBase):
    id: int
    created_at: datetime.datetime


class BuildingBase(BaseModel):
    name: str


class BuildingCreate(BuildingBase):
    pass


class BuildingItem(BuildingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime


# Update forward references to resolve circular dependencies
StandardItem.model_rebuild()
Project.model_rebuild()
User.model_rebuild()
FamilyListItem.model_rebuild()
CalcDictionaryEntry.model_rebuild()
FamilyRevitType.model_rebuild()

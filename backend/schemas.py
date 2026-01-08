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
    derive_from: Optional[int] = None


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
    add_spec: Optional[str] = None
    gauge: Optional[str] = None


class WorkMasterCreate(WorkMasterBase):
    pass


class WorkMasterUpdate(BaseModel):
    add_spec: Optional[str] = None
    gauge: Optional[str] = None


class WorkMasterPrecheckState(BaseModel):
    work_master_id: int
    use_yn: bool
    updated_at: Optional[str] = None
    other_opinion: Optional[str] = None


class WorkMasterPrecheckUpdate(BaseModel):
    use_yn: Optional[bool] = None
    other_opinion: Optional[str] = None


class WorkMaster(WorkMasterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    standard_items: List[_StandardItemWithoutRelations] = []


class WorkMasterBrief(BaseModel):
    """Small WorkMaster shape for exports."""

    id: int
    work_master_code: str
    gauge: Optional[str] = None
    discipline: Optional[str] = None
    cat_large_desc: Optional[str] = None
    cat_mid_desc: Optional[str] = None
    cat_small_desc: Optional[str] = None
    uom1: Optional[str] = None
    uom2: Optional[str] = None


# WorkMaster cart schemas
class WorkMasterCartEntryBase(BaseModel):
    revit_types: List[str]
    assignment_ids: List[int]
    standard_item_ids: List[int]
    building_names: List[str] = Field(default_factory=list)
    formula: Optional[str] = None


class WorkMasterCartEntryCreate(WorkMasterCartEntryBase):
    pass


class WorkMasterCartEntryUpdate(BaseModel):
    formula: Optional[str] = None


class WorkMasterCartEntry(WorkMasterCartEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    assignment_labels: List[str] = Field(default_factory=list)
    standard_item_names: List[str] = Field(default_factory=list)
    work_masters: List[WorkMasterBrief] = Field(default_factory=list)
    calc_dictionary_entries: List["CalcDictionarySymbol"] = Field(default_factory=list)


class DynamoWorkMasterCartEntry(BaseModel):
    """Export-only cart row shape for Dynamo JSON.

    Dynamo export expects each row to carry a single value/object for these fields.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    revit_type: Optional[str] = None
    assignment_id: Optional[int] = None
    standard_item_id: Optional[int] = None
    building_name: Optional[str] = None
    formula: Optional[str] = None

    category: Optional[str] = Field(default=None, alias="카테고리")
    standard_type_number: Optional[str] = Field(default=None, alias="표준타입 번호")
    standard_type_name: Optional[str] = Field(default=None, alias="표준타입 이름")
    classification: Optional[str] = Field(default=None, alias="분류")
    detail_classification: Optional[str] = Field(default=None, alias="상세분류")
    unit: Optional[str] = Field(default=None, alias="단위")

    id: int
    created_at: datetime.datetime
    assignment_label: Optional[str] = None
    standard_item_name: Optional[str] = None
    work_master: Optional[WorkMasterBrief] = None
    calc_dictionary_entries: List["CalcDictionarySymbol"] = Field(default_factory=list)


# StandardItem Schemas
class StandardItemBase(BaseModel):
    name: str
    type: StandardItemType
    parent_id: Optional[int] = None
    derive_from: Optional[int] = None


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
    selected_work_master_id: Optional[int] = None
    derive_from: Optional[int] = None


class StandardItemWorkMasterSelectionRequest(BaseModel):
    work_master_id: Optional[int] = None


class WorkMasterSummaryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    standard_item_id: int
    standard_item_name: str
    standard_item_type: StandardItemType
    standard_item_path: str

    work_master_id: int
    work_master_code: str
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
    new_old_code: Optional[str] = None
    gauge: Optional[str] = None
    add_spec: Optional[str] = None


class WorkMasterSummaryResponse(BaseModel):
    rows: List[WorkMasterSummaryRow] = Field(default_factory=list)


class DynamoProjectExportPayload(BaseModel):
    """Dynamo 테스트용으로 프로젝트 DB 내용을 JSON으로 추출하기 위한 페이로드."""

    exported_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    project_identifier: str
    buildings: List["BuildingItem"] = Field(default_factory=list)
    workmaster_cart_entries: List[DynamoWorkMasterCartEntry] = Field(
        default_factory=list
    )
    wm_selection_summary: Optional[WorkMasterSummaryResponse] = None


class CalcResultImportResponse(BaseModel):
    project_identifier: str
    building_name: Optional[str] = None
    inserted: int = 0


class CalcResultRow(BaseModel):
    id: int
    created_at: str
    building_name: Optional[str] = None

    category: Optional[str] = None
    standard_type_number: Optional[str] = None
    standard_type_name: Optional[str] = None
    classification: Optional[str] = None
    description: Optional[str] = None

    guid: Optional[str] = None
    gui: Optional[str] = None
    member_name: Optional[str] = None

    wm_code: Optional[str] = None
    gauge: Optional[str] = None
    spec: Optional[str] = None
    add_spec: Optional[str] = None

    formula: Optional[str] = None
    substituted_formula: Optional[str] = None
    result: Optional[float] = None
    result_log: Optional[str] = None
    unit: Optional[str] = None


class DerivedStandardItemCreate(BaseModel):
    suffix_description: str
    work_master_id: Optional[int] = None


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


class ProjectCalcDictionaryEntryCreate(CalcDictionaryEntryBase):
    family_list_id: Optional[int] = None


class CalcDictionaryEntryUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    family_list_id: Optional[int] = None
    calc_code: Optional[str] = None
    symbol_key: Optional[str] = None
    symbol_value: Optional[str] = None


class CalcDictionaryEntry(CalcDictionaryEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    family_list_id: Optional[int] = None
    created_at: datetime.datetime
    family_item: Optional[_FamilyListWithoutRelations] = None


class CalcDictionarySymbol(BaseModel):
    """Minimal calc_dictionary entry for exports (cart row context)."""

    family_list_id: Optional[int] = None
    family_name: Optional[str] = None
    calc_code: Optional[str] = None
    symbol_key: str
    symbol_value: str


class FamilyRevitTypeBase(BaseModel):
    type_name: str
    building_name: Optional[str] = None


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
    entries: List[FamilyRevitTypeBase] = Field(default_factory=list)


class CalcDictionarySyncResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    updated_entries: int


class ProjectMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pjt_abbr: Optional[str] = None
    pjt_description: Optional[str] = None


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
WorkMasterCartEntry.model_rebuild()
DynamoWorkMasterCartEntry.model_rebuild()

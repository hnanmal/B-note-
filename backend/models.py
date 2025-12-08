from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Table,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
import datetime
import enum

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True, nullable=False)
    project_code = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    creation_date = Column(DateTime, default=datetime.datetime.utcnow)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projects")

    # 예시: 빌딩과의 관계. 추후 Building 모델 생성 시 활성화
    # buildings = relationship("Building", back_populates="project", cascade="all, delete-orphan")


# Building list for project-specific data
class BuildingList(Base):
    __tablename__ = "building_list"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


# 여기에 Building 등 다른 모델들을 계속해서 추가해나갈 예정입니다.


class WorkMaster(Base):
    __tablename__ = "work_masters"

    id = Column(Integer, primary_key=True, index=True)
    discipline = Column(String, index=True)
    cat_large_code = Column(String, index=True)
    cat_large_desc = Column(String)
    cat_mid_code = Column(String, index=True)
    cat_mid_desc = Column(String)
    cat_small_code = Column(String, index=True)
    cat_small_desc = Column(String)
    attr1_code = Column(String)
    attr1_spec = Column(String)
    attr2_code = Column(String)
    attr2_spec = Column(String)
    attr3_code = Column(String)
    attr3_spec = Column(String)
    attr4_code = Column(String)
    attr4_spec = Column(String)
    attr5_code = Column(String)
    attr5_spec = Column(String)
    attr6_code = Column(String)
    attr6_spec = Column(String)
    uom1 = Column(String)
    uom2 = Column(String)
    work_group_code = Column(String)
    work_master_code = Column(String, unique=True, index=True)
    new_old_code = Column(String)
    add_spec = Column(String)

    # Many-to-Many relationship with StandardItem
    standard_items = relationship(
        "StandardItem",
        secondary="standard_item_work_master_association",
        back_populates="work_masters",
    )

    selected_in_standard_items = relationship(
        "StandardItemWorkMasterSelect",
        back_populates="work_master",
    )


# Association Table for StandardItem and WorkMaster
standard_item_work_master_association = Table(
    "standard_item_work_master_association",
    Base.metadata,
    Column("standard_item_id", Integer, ForeignKey("standard_items.id")),
    Column("work_master_id", Integer, ForeignKey("work_masters.id")),
)


class StandardItemType(str, enum.Enum):
    GWM = "GWM"
    SWM = "SWM"


class StandardItem(Base):
    __tablename__ = "standard_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(StandardItemType), nullable=False)

    parent_id = Column(Integer, ForeignKey("standard_items.id"))
    parent = relationship("StandardItem", remote_side=[id], back_populates="children")
    children = relationship(
        "StandardItem", back_populates="parent", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with WorkMaster
    work_masters = relationship(
        "WorkMaster",
        secondary=standard_item_work_master_association,
        back_populates="standard_items",
    )

    selected_work_master_assoc = relationship(
        "StandardItemWorkMasterSelect",
        uselist=False,
        back_populates="standard_item",
        cascade="all, delete-orphan",
    )


class StandardItemWorkMasterSelect(Base):
    __tablename__ = "standard_item_work_master_select"

    id = Column(Integer, primary_key=True, index=True)
    standard_item_id = Column(Integer, ForeignKey("standard_items.id"), nullable=False, unique=True)
    work_master_id = Column(Integer, ForeignKey("work_masters.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    standard_item = relationship("StandardItem", back_populates="selected_work_master_assoc")
    work_master = relationship("WorkMaster", back_populates="selected_in_standard_items")


class CommonInput(Base):
    __tablename__ = "common_input"

    id = Column(Integer, primary_key=True, index=True)
    classification = Column(String, index=True, nullable=False)
    abbreviation = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    input_value = Column(String, nullable=True)
    unit = Column(String, nullable=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class FamilyListItem(Base):
    __tablename__ = "family_list"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    item_type = Column(String, nullable=False, default="FAMILY")
    parent_id = Column(Integer, ForeignKey("family_list.id"), nullable=True)
    sequence_number = Column(String, nullable=True)
    description = Column(String, nullable=True)
    calc_dictionary_entries = relationship(
        "CalcDictionaryEntry",
        back_populates="family_list_item",
        cascade="all, delete-orphan",
    )
    revit_types = relationship(
        "FamilyRevitType",
        back_populates="family_list_item",
        cascade="all, delete-orphan",
        order_by="FamilyRevitType.id",
    )

    parent = relationship("FamilyListItem", remote_side=[id], back_populates="children")
    children = relationship(
        "FamilyListItem", back_populates="parent", cascade="all, delete-orphan"
    )
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class CalcDictionaryEntry(Base):
    __tablename__ = "calc_dictionary"

    id = Column(Integer, primary_key=True, index=True)
    family_list_id = Column(Integer, ForeignKey("family_list.id"), nullable=False)
    calc_code = Column(String, nullable=True)
    symbol_key = Column(String, nullable=False)
    symbol_value = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    family_list_item = relationship(
        "FamilyListItem", back_populates="calc_dictionary_entries"
    )


class FamilyRevitType(Base):
    __tablename__ = "family_revit_type"

    id = Column(Integer, primary_key=True, index=True)
    family_list_id = Column(Integer, ForeignKey("family_list.id"), nullable=False)
    type_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    family_list_item = relationship(
        "FamilyListItem", back_populates="revit_types"
    )


class GwmFamilyAssign(Base):
    __tablename__ = "gwm_family_assign"
    __table_args__ = (
        UniqueConstraint(
            "family_list_id", "standard_item_id", name="uq_gfa_family_standard"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    family_list_id = Column(Integer, ForeignKey("family_list.id"), nullable=False)
    standard_item_id = Column(Integer, ForeignKey("standard_items.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    formula = Column(Text, nullable=True)
    description = Column(Text, nullable=True)

    family_list_item = relationship("FamilyListItem")
    standard_item = relationship("StandardItem")

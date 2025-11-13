from pydantic import BaseModel, EmailStr
from typing import List, Optional
import datetime

# ===================
#      Project
# ===================
class ProjectBase(BaseModel):
    project_name: str
    project_code: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    owner_id: int
    creation_date: datetime.datetime

    class Config:
        orm_mode = True

# ===================
#        User
# ===================
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    projects: List[Project] = []

    class Config:
        orm_mode = True



# ===================
#     WorkMaster
# ===================
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
    id: int

    class Config:
        orm_mode = True
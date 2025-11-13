from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime

from database import Base


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
    uom1 = Column("UoM1", String) # 'UoM1'
    uom2 = Column("UoM2", String) # 'UoM2'
    work_group_code = Column(String)
    work_master_code = Column(String, unique=True, index=True)
    new_old_code = Column(String)
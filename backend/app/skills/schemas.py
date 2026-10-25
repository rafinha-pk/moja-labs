from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.common import Name

Description = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=300)
]
Content = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=20000),
]


class SkillCreate(BaseModel):
    name: Name
    description: Description | None = None
    content: Content


class SkillUpdate(BaseModel):
    name: Name | None = None
    description: Description | None = None
    content: Content | None = None


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    updated_at: datetime


class SkillDetail(SkillOut):
    content: str


class ProjectSkillsUpdate(BaseModel):
    skill_ids: list[int]


class ProjectSkillOut(BaseModel):
    stage_key: str
    skill_id: int
    name: str
    description: str | None
    position: int

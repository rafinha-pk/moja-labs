from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.common import Name
from app.projects.models import ProjectType

Description = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=5000)
]


AccessUrl = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, max_length=300, pattern=r"^https?://\S+$"
    ),
]


class ProjectCreate(BaseModel):
    name: Name
    description: Description | None = None
    type: ProjectType


class ProjectUpdate(BaseModel):
    name: Name | None = None
    access_url: AccessUrl | None = None
    description: Description | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    type: ProjectType
    owner_id: int
    role: str
    member_role: str | None
    specialty: str = "fullstack"
    access_url: str | None = None
    tasks_total: int = 0
    tasks_done: int = 0
    created_at: datetime

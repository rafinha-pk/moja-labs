from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

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


AndroidPackage = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        max_length=100,
        pattern=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$",
    ),
]


class ProjectUpdate(BaseModel):
    name: Name | None = None
    access_url: AccessUrl | None = None
    description: Description | None = None
    android_package: AndroidPackage | None = None
    android_min_sdk: Annotated[int, Field(ge=24, le=35)] | None = None


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
    android_package: str | None = None
    android_min_sdk: int = 24
    tasks_total: int = 0
    tasks_done: int = 0
    created_at: datetime

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.tasks.models import StageStatus

Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=5000)
]


class TaskCreate(BaseModel):
    title: Title
    description: Description | None = None


class TaskUpdate(BaseModel):
    title: Title | None = None
    description: Description | None = None


class StageUpdate(BaseModel):
    status: StageStatus


class TaskStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    status: StageStatus


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: StageStatus
    stages: list[TaskStageOut]
    created_at: datetime
    updated_at: datetime

from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    StringConstraints,
)

from app.agent.options import EFFORTS, MODELS
from app.tasks.models import TaskArea, TaskSource, TaskStatus


def _one_of(options: tuple[str, ...]):
    def check(value: str) -> str:
        if value not in options:
            raise ValueError("invalid_option")
        return value

    return AfterValidator(check)


Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=5000)
]
Model = Annotated[str, _one_of(MODELS)]
Effort = Annotated[str, _one_of(EFFORTS)]


class TaskCreate(BaseModel):
    title: Title
    description: Description | None = None
    area: TaskArea = TaskArea.FULLSTACK


class TaskUpdate(BaseModel):
    title: Title | None = None
    description: Description | None = None
    status: TaskStatus | None = None
    area: TaskArea | None = None
    model: Model | None = None
    effort: Effort | None = None
    thinking: bool | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TaskStatus
    position: int
    area: TaskArea
    archived_at: datetime | None = None
    archived_commit: str | None = None
    source: TaskSource
    model: str | None
    effort: str | None
    thinking: bool | None
    run_id: int | None = None
    created_at: datetime
    updated_at: datetime


class SettingsIn(BaseModel):
    model: Model
    effort: Effort
    thinking: bool


class SettingsOut(SettingsIn):
    models: list[str]
    efforts: list[str]


class ChangedDoc(BaseModel):
    path: str
    status: Literal["added", "modified", "removed"]


class PlanState(BaseModel):
    first: bool
    changed_files: list[ChangedDoc]
    can_search: bool
    reason: str | None


class PlanApply(BaseModel):
    run_id: int

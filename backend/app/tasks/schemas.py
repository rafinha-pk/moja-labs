from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    StringConstraints,
)

from app.agent.options import EFFORTS, MODELS
from app.tasks.models import TaskSource, TaskStatus


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


class TaskUpdate(BaseModel):
    title: Title | None = None
    description: Description | None = None
    status: TaskStatus | None = None
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


class PlanState(BaseModel):
    head: str | None
    base: str | None
    uncommitted: bool
    changed_files: list[str]
    can_search: bool
    reason: str | None


class PlanApply(BaseModel):
    run_id: int

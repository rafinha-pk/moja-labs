from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class StageKey(StrEnum):
    MODELING = "modeling"
    CODING = "coding"
    TESTING = "testing"
    DEPLOY = "deploy"


class StageStatus(StrEnum):
    TODO = "todo"
    DOING = "doing"
    DONE = "done"
    SKIPPED = "skipped"


OPEN_STATUSES = (StageStatus.TODO.value, StageStatus.DOING.value)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )


class TaskStage(Base):
    __tablename__ = "task_stages"
    __table_args__ = (
        UniqueConstraint("task_id", "key", name="uq_task_stages_task_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(
        String(20), default=StageStatus.TODO.value
    )
    position: Mapped[int]
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

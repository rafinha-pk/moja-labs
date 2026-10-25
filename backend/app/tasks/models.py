from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class TaskStatus(StrEnum):
    TODO = "todo"
    QUEUED = "queued"
    DOING = "doing"
    DONE = "done"
    FAILED = "failed"


class TaskSource(StrEnum):
    MANUAL = "manual"
    AI = "ai"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(10), default=TaskStatus.TODO.value
    )
    position: Mapped[int]
    source: Mapped[str] = mapped_column(
        String(10), default=TaskSource.MANUAL.value
    )
    model: Mapped[str | None] = mapped_column(String(40))
    effort: Mapped[str | None] = mapped_column(String(10))
    thinking: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

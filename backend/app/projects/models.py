from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class ProjectType(StrEnum):
    WEB = "web"
    YOUTUBE = "youtube"
    MOBILE = "mobile"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20))
    access_url: Mapped[str | None] = mapped_column(String(300))
    run_command: Mapped[str | None] = mapped_column(Text)
    tasks_model: Mapped[str] = mapped_column(
        String(40), default="claude-sonnet-5-5"
    )
    tasks_effort: Mapped[str] = mapped_column(String(10), default="medium")
    tasks_thinking: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

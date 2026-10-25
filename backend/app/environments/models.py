from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class EnvironmentStatus(StrEnum):
    BUILDING = "building"
    READY = "ready"
    FAILED = "failed"


class ProjectEnvironment(Base):
    __tablename__ = "project_environments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(String(10))
    container: Mapped[str | None] = mapped_column(String(100))
    image: Mapped[str | None] = mapped_column(String(100))
    workspace: Mapped[str | None] = mapped_column(String(500))
    port: Mapped[int | None]
    error_code: Mapped[str | None] = mapped_column(String(40))
    log: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

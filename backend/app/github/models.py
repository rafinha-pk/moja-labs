from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class GithubCredential(Base):
    __tablename__ = "github_credentials"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    token_encrypted: Mapped[str] = mapped_column(Text)
    login: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )


class ProjectRepository(Base):
    __tablename__ = "project_repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    full_name: Mapped[str] = mapped_column(String(200))
    html_url: Mapped[str] = mapped_column(String(300))
    is_private: Mapped[bool]
    origin: Mapped[str] = mapped_column(String(10), server_default="linked")
    initialized_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

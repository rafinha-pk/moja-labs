from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class InviteStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "user_id", name="uq_project_members_project_user"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    specialty: Mapped[str] = mapped_column(String(10), default="fullstack")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class ProjectInvite(Base):
    __tablename__ = "project_invites"
    __table_args__ = (
        Index("ix_project_invites_email_status", "email", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(20))
    specialty: Mapped[str] = mapped_column(String(10), default="fullstack")
    invited_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(
        String(20), default=InviteStatus.PENDING.value
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    responded_at: Mapped[datetime | None]

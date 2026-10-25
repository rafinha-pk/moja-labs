from datetime import datetime

from sqlalchemy import String, false, true
from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base

DEFAULT_THEME = "dev-dark"
THEMES = {"dev-dark", "dev-light"}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    theme: Mapped[str] = mapped_column(
        String(32), default=DEFAULT_THEME, server_default=DEFAULT_THEME
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, server_default=true()
    )
    is_superadmin: Mapped[bool] = mapped_column(
        default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from app.clock import utcnow
from app.db import Base


class ClaudeUsage(Base):
    __tablename__ = "claude_usage"

    id: Mapped[int] = mapped_column(primary_key=True)
    five_hour_percent: Mapped[float | None]
    five_hour_resets_at: Mapped[datetime | None]
    seven_day_percent: Mapped[float | None]
    seven_day_resets_at: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow
    )

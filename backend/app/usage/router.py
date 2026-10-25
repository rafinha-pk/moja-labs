import shutil
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.ratelimit import usage_limiter
from app.db import get_db
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.usage import service
from app.usage.models import ClaudeUsage
from app.users.models import User

router = APIRouter(prefix="/usage", tags=["usage"])


class UsageWindow(BaseModel):
    percent: float
    resets_at: datetime


class UsageOut(BaseModel):
    five_hour: UsageWindow | None
    seven_day: UsageWindow | None
    updated_at: datetime | None


def _out(db: Session) -> UsageOut:
    row = db.get(ClaudeUsage, service.ROW_ID)
    if row is None:
        return UsageOut(five_hour=None, seven_day=None, updated_at=None)

    def window(name: str) -> UsageWindow | None:
        percent = getattr(row, f"{name}_percent")
        resets = getattr(row, f"{name}_resets_at")
        if percent is None or resets is None:
            return None
        return UsageWindow(percent=percent, resets_at=resets)

    return UsageOut(
        five_hour=window("five_hour"),
        seven_day=window("seven_day"),
        updated_at=row.updated_at,
    )


@router.get("", response_model=UsageOut)
def read_usage(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _out(db)


@router.post("/refresh", response_model=UsageOut)
def refresh_usage(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    if shutil.which(tools.claude_command[0]) is None:
        raise AppError(409, "claude_unavailable")
    key = f"usage:{user.id}"
    if usage_limiter.is_blocked(key):
        raise AppError(429, "too_many_attempts")
    usage_limiter.hit(key)
    if not service.probe(db, tools):
        raise AppError(502, "usage_unavailable")
    db.expire_all()
    return _out(db)

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict

from app.common import Name
from app.users.models import THEMES


def _check_theme(value: str) -> str:
    if value not in THEMES:
        raise ValueError("invalid_theme")
    return value


Theme = Annotated[str, AfterValidator(_check_theme)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    theme: str
    is_superadmin: bool
    created_at: datetime


class UserUpdate(BaseModel):
    name: Name | None = None
    theme: Theme | None = None

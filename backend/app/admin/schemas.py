from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.common import Email, Name, Password


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    is_active: bool
    is_superadmin: bool
    created_at: datetime
    projects_count: int = 0
    owned_projects_count: int = 0


class AdminUserCreate(BaseModel):
    email: Email
    name: Name
    password: Password
    is_superadmin: bool = False


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_superadmin: bool | None = None


class AdminProjectOut(BaseModel):
    id: int
    name: str
    type: str
    role: str

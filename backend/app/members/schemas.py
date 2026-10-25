from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.common import Email

AssignableRole = Literal["po", "dev"]
SpecialtyName = Literal["frontend", "backend", "fullstack"]


class MemberOut(BaseModel):
    user_id: int
    email: str
    name: str
    role: str
    specialty: str
    joined_at: datetime


class InviteCreate(BaseModel):
    email: Email
    role: AssignableRole
    specialty: SpecialtyName = "fullstack"


class InviteOut(BaseModel):
    id: int
    project_id: int
    project_name: str
    email: str
    role: str
    specialty: str
    invited_by_name: str
    status: str
    created_at: datetime


class RoleUpdate(BaseModel):
    role: AssignableRole
    specialty: SpecialtyName | None = None


class TransferOwnership(BaseModel):
    user_id: int
    previous_owner_role: AssignableRole = "dev"

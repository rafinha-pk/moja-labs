from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.admin.schemas import (
    AdminProjectOut,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
)
from app.auth import service
from app.auth.deps import require_superadmin
from app.db import get_db
from app.errors import AppError
from app.members.models import ProjectMember
from app.projects.models import Project
from app.users.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


def _users_with_counts():
    memberships = (
        select(func.count())
        .select_from(ProjectMember)
        .where(ProjectMember.user_id == User.id)
        .scalar_subquery()
    )
    owned = (
        select(func.count())
        .select_from(Project)
        .where(Project.owner_id == User.id)
        .scalar_subquery()
    )
    return select(User, memberships, owned)


def _out(user: User, projects: int, owned: int) -> AdminUserOut:
    return AdminUserOut.model_validate(user).model_copy(
        update={"projects_count": projects, "owned_projects_count": owned}
    )


def _find_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "user_not_found")
    return user


def _out_for(db: Session, user_id: int) -> AdminUserOut:
    query = _users_with_counts().where(User.id == user_id)
    return _out(*db.execute(query).one())


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _: User = Depends(require_superadmin), db: Session = Depends(get_db)
):
    query = _users_with_counts().order_by(
        User.created_at.desc(), User.id.desc()
    )
    return [_out(*row) for row in db.execute(query)]


@router.post("/users", response_model=AdminUserOut, status_code=201)
def create_user(
    body: AdminUserCreate,
    _: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = service.register_user(
        db, body.email, body.name, body.password, body.is_superadmin
    )
    return _out(user, 0, 0)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = _find_user(db, user_id)
    if user.id == admin.id:
        raise AppError(409, "cannot_modify_self")
    if body.is_superadmin is not None:
        user.is_superadmin = body.is_superadmin
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            service.revoke_all_user_tokens(db, user.id)
    db.commit()
    return _out_for(db, user.id)


@router.get("/users/{user_id}/projects", response_model=list[AdminProjectOut])
def user_projects(
    user_id: int,
    _: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    _find_user(db, user_id)
    rows = db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user_id)
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    return [
        AdminProjectOut(id=p.id, name=p.name, type=p.type, role=role)
        for p, role in rows
    ]

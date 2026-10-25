from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.errors import AppError
from app.members.models import ProjectMember
from app.members.permissions import (
    Permission,
    Role,
    Specialty,
    allowed_areas,
    has_permission,
)
from app.projects.models import Project
from app.users.models import User


@dataclass
class ProjectAccess:
    project: Project
    membership: ProjectMember | None
    user: User

    @property
    def role(self) -> Role:
        if self.user.is_superadmin or self.membership is None:
            return Role.OWNER
        return Role(self.membership.role)

    @property
    def specialty(self) -> str:
        if self.role != Role.DEV or self.membership is None:
            return Specialty.FULLSTACK.value
        return self.membership.specialty

    @property
    def areas(self) -> frozenset[str]:
        return allowed_areas(self.specialty)


def member_specialty(db: Session, project_id: int, user: User) -> str:
    if user.is_superadmin:
        return Specialty.FULLSTACK.value
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
        )
    )
    if membership is None or membership.role != Role.DEV.value:
        return Specialty.FULLSTACK.value
    return membership.specialty


def project_access(permission: Permission) -> Callable[..., ProjectAccess]:

    def dependency(
        project_id: int,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> ProjectAccess:
        row = db.execute(
            select(Project, ProjectMember)
            .outerjoin(
                ProjectMember,
                (ProjectMember.project_id == Project.id)
                & (ProjectMember.user_id == user.id),
            )
            .where(Project.id == project_id)
        ).first()
        if row is None or (row[1] is None and not user.is_superadmin):
            raise AppError(404, "project_not_found")
        access = ProjectAccess(project=row[0], membership=row[1], user=user)
        if not has_permission(access.role, permission):
            raise AppError(403, "forbidden")
        return access

    return dependency


can_view_project = Depends(project_access(Permission.PROJECT_VIEW))
can_edit_project = Depends(project_access(Permission.PROJECT_EDIT))
can_delete_project = Depends(project_access(Permission.PROJECT_DELETE))
can_view_members = Depends(project_access(Permission.MEMBERS_VIEW))
can_edit_planning = Depends(project_access(Permission.PLANNING_EDIT))
can_run_project = Depends(project_access(Permission.CODE_WRITE))
can_manage_integrations = Depends(
    project_access(Permission.INTEGRATIONS_MANAGE)
)
can_manage_members = Depends(project_access(Permission.MEMBERS_MANAGE))

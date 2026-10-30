from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.service import purge_runs
from app.auth.deps import get_current_user
from app.db import get_db
from app.environments.service import teardown
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_delete_project,
    can_edit_project,
    can_view_project,
)
from app.members.models import ProjectMember
from app.members.permissions import Role
from app.projects.models import Project
from app.projects.schemas import (
    ANDROID_ABIS,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
)
from app.tasks.service import task_counts
from app.users.models import User

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_out(
    project: Project,
    role: str,
    member_role: str | None,
    progress: tuple[int, int] = (0, 0),
    specialty: str = "fullstack",
) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        type=project.type,
        owner_id=project.owner_id,
        role=role,
        member_role=member_role,
        specialty=specialty,
        access_url=project.access_url,
        android_package=project.android_package,
        android_min_sdk=project.android_min_sdk,
        android_abis=project.android_abis.split(","),
        tasks_total=progress[0],
        tasks_done=progress[1],
        created_at=project.created_at,
    )


def _access_out(access: ProjectAccess, db: Session) -> ProjectOut:
    member_role = access.membership.role if access.membership else None
    progress = task_counts(db, [access.project.id])
    return _to_out(
        access.project,
        access.role.value,
        member_role,
        progress.get(access.project.id, (0, 0)),
        access.specialty,
    )


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=body.name,
        description=body.description or None,
        type=body.type.value,
        owner_id=user.id,
    )
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(
            project_id=project.id, user_id=user.id, role=Role.OWNER.value
        )
    )
    db.commit()
    progress = task_counts(db, [project.id]).get(project.id, (0, 0))
    return _to_out(project, Role.OWNER.value, Role.OWNER.value, progress)


@router.get("", response_model=list[ProjectOut])
def list_projects(
    scope: Literal["mine", "all"] = "mine",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if scope == "all" and not user.is_superadmin:
        raise AppError(403, "forbidden")
    query = (
        select(Project, ProjectMember.role)
        .outerjoin(
            ProjectMember,
            (ProjectMember.project_id == Project.id)
            & (ProjectMember.user_id == user.id),
        )
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    if scope == "mine":
        query = query.where(ProjectMember.user_id == user.id)
    rows = db.execute(query).all()
    progress = task_counts(db, [project.id for project, _ in rows])
    return [
        _to_out(
            project,
            role or Role.OWNER.value,
            role,
            progress.get(project.id, (0, 0)),
        )
        for project, role in rows
    ]


@router.get("/{project_id}", response_model=ProjectOut)
def read_project(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return _access_out(access, db)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    body: ProjectUpdate,
    access: ProjectAccess = can_edit_project,
    db: Session = Depends(get_db),
):
    if body.name is not None:
        access.project.name = body.name
    if "description" in body.model_fields_set:
        access.project.description = body.description or None
    if "access_url" in body.model_fields_set:
        access.project.access_url = body.access_url or None
    if body.android_package is not None:
        access.project.android_package = body.android_package
    if body.android_min_sdk is not None:
        access.project.android_min_sdk = body.android_min_sdk
    if body.android_abis is not None:
        chosen = set(body.android_abis)
        access.project.android_abis = ",".join(
            abi for abi in ANDROID_ABIS if abi in chosen
        )
    db.commit()
    return _access_out(access, db)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    access: ProjectAccess = can_delete_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    teardown(db, access.project.id, tools.docker)
    purge_runs(db, access.project.id, tools.claude_home)
    db.delete(access.project)
    db.commit()
    return Response(status_code=204)

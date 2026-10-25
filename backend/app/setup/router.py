from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.environments.service import (
    EnvironmentOut,
    current,
    environment_out,
)
from app.environments.tools import EnvironmentTools, environment_tools
from app.github.client import GitHubClient, github_client_factory
from app.github.schemas import RepositoryCreate
from app.github.service import initialize_repository
from app.members.access import (
    ProjectAccess,
    can_manage_integrations,
    can_view_project,
)
from app.projects.models import Project
from app.setup.service import (
    run_setup,
    setup_complete,
    setup_steps,
    start_environment,
)

router = APIRouter(prefix="/projects/{project_id}/setup", tags=["setup"])


class SetupStep(BaseModel):
    key: str
    status: Literal["todo", "doing", "done", "skipped", "failed"]


class SetupOut(BaseModel):
    complete: bool
    steps: list[SetupStep]


class SetupRun(BaseModel):
    repository: RepositoryCreate | None = None


def _out(db: Session, project: Project) -> SetupOut:
    return SetupOut(
        complete=setup_complete(db, project),
        steps=setup_steps(db, project),
    )


@router.get("", response_model=SetupOut)
def read_setup(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return _out(db, access.project)


@router.post("/run", response_model=SetupOut)
def run_pending_steps(
    body: SetupRun,
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
    tools: EnvironmentTools = Depends(environment_tools),
):
    run_setup(db, access.project, make_client, tools, body.repository)
    return _out(db, access.project)


@router.post("/initial-commit", response_model=SetupOut)
def run_initial_commit(
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
):
    initialize_repository(db, access.project, make_client)
    return _out(db, access.project)


@router.get("/environment", response_model=EnvironmentOut)
def read_environment(
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    return environment_out(current(db, access.project.id), tools)


@router.post("/environment", response_model=EnvironmentOut)
def build_environment_now(
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    start_environment(db, access.project, tools)
    db.expire_all()
    return environment_out(current(db, access.project.id), tools)

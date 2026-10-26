from typing import Annotated

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.db import get_db
from app.environments import apk, runner
from app.environments.docker import DockerError
from app.environments.models import EnvironmentStatus, ProjectEnvironment
from app.environments.service import current
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_run_project,
    can_view_project,
)
from app.projects.models import Project

router = APIRouter(prefix="/projects/{project_id}/run", tags=["run"])

Command = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2000),
]


class CommandIn(BaseModel):
    command: Command


class RunOut(BaseModel):
    command: str | None
    running: bool
    ready: bool
    url: str | None
    log: str


def _usable(environment: ProjectEnvironment | None) -> bool:
    return (
        environment is not None
        and environment.status == EnvironmentStatus.READY.value
        and environment.port is not None
    )


def _url(
    environment: ProjectEnvironment | None, tools: EnvironmentTools
) -> str | None:
    return (
        f"http://{tools.public_host}:{environment.port}"
        if _usable(environment)
        else None
    )


def _out(db: Session, project: Project, tools: EnvironmentTools) -> RunOut:
    environment = current(db, project.id)
    ready = _usable(environment)
    running = ready and runner.is_running(tools.docker, environment.container)
    log = runner.read_log(tools.docker, environment.container) if ready else ""
    return RunOut(
        command=project.run_command,
        running=running,
        ready=ready,
        url=_url(environment, tools),
        log=log,
    )


def _require_ready(db: Session, project: Project) -> ProjectEnvironment:
    environment = current(db, project.id)
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
    ):
        raise AppError(409, "environment_not_ready")
    if environment.port is None:
        raise AppError(409, "environment_outdated")
    return environment


class ApkOut(BaseModel):
    available: bool
    state: str
    log: str
    package: str | None
    size: int | None
    built_at: datetime | None


def _mobile_environment(
    db: Session, project: Project
) -> tuple[ProjectEnvironment, Path]:
    if project.type != "mobile":
        raise AppError(409, "not_mobile")
    environment = _require_ready(db, project)
    return environment, Path(environment.workspace)


@router.get("/apk", response_model=ApkOut)
def read_apk(
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    environment = current(db, project.id)
    if project.type != "mobile" or not _usable(environment):
        return ApkOut(
            available=False,
            state="idle",
            log="",
            package=project.android_package,
            size=None,
            built_at=None,
        )
    state = apk.read_state(
        tools.docker, environment.container, Path(environment.workspace)
    )
    return ApkOut(
        available=True,
        state=state.state,
        log=state.log,
        package=project.android_package,
        size=state.size,
        built_at=state.built_at,
    )


@router.post("/apk", response_model=ApkOut, status_code=202)
def start_apk(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    environment, workspace = _mobile_environment(db, project)
    if not (workspace / "frontend" / "package.json").is_file():
        raise AppError(409, "app_missing")
    if not project.android_package:
        raise AppError(409, "package_missing")
    if runner.is_running(tools.docker, environment.container, runner.BUILD):
        raise AppError(409, "build_running")
    try:
        runner.start(
            tools.docker,
            environment.container,
            apk.build_script(project.android_package, project.android_min_sdk),
            runner.BUILD,
        )
    except DockerError:
        raise AppError(502, "docker_unavailable") from None
    return read_apk(access, db, tools)


@router.post("/apk/stop", response_model=ApkOut)
def stop_apk(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    environment, _ = _mobile_environment(db, access.project)
    try:
        runner.stop(tools.docker, environment.container, runner.BUILD)
    except DockerError:
        raise AppError(502, "docker_unavailable") from None
    return read_apk(access, db, tools)


@router.get("/apk/file")
def download_apk(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    environment = current(db, access.project.id)
    if access.project.type != "mobile" or not _usable(environment):
        raise AppError(404, "apk_not_found")
    file = apk.apk_path(Path(environment.workspace))
    if not file.is_file():
        raise AppError(404, "apk_not_found")
    return FileResponse(
        file,
        media_type="application/vnd.android.package-archive",
        filename=f"{access.project.name}-debug.apk",
    )


@router.get("", response_model=RunOut)
def read_run(
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    return _out(db, access.project, tools)


@router.put("/command", response_model=RunOut)
def set_command(
    body: CommandIn,
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    access.project.run_command = body.command
    db.commit()
    return _out(db, access.project, tools)


@router.post("/start", response_model=RunOut)
def start_project(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    environment = _require_ready(db, project)
    if not project.run_command:
        raise AppError(409, "run_command_missing")
    if runner.is_running(tools.docker, environment.container):
        raise AppError(409, "already_running")
    try:
        runner.start(tools.docker, environment.container, project.run_command)
    except DockerError:
        raise AppError(502, "docker_unavailable") from None
    own_hosts = (f"http://{tools.public_host}:", "http://localhost:")
    if project.access_url is None or project.access_url.startswith(own_hosts):
        project.access_url = _url(environment, tools)
    db.commit()
    return _out(db, project, tools)


@router.post("/stop", response_model=RunOut)
def stop_project(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    environment = _require_ready(db, access.project)
    try:
        runner.stop(tools.docker, environment.container)
    except DockerError:
        raise AppError(502, "docker_unavailable") from None
    return _out(db, access.project, tools)

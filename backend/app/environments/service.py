import shutil
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.environments.builder import build_environment, container_name
from app.environments.docker import Docker, DockerError
from app.environments.models import EnvironmentStatus, ProjectEnvironment
from app.environments.tools import EnvironmentTools
from app.errors import AppError
from app.github.service import usable_token
from app.projects.models import Project

LOG_TAIL = 8000


class EnvironmentOut(BaseModel):
    status: Literal["todo", "building", "ready", "failed"]
    container: str | None
    image: str | None
    workspace: str | None
    port: int | None
    error_code: str | None
    log: str
    claude_available: bool


def current(db: Session, project_id: int) -> ProjectEnvironment | None:
    return db.scalar(
        select(ProjectEnvironment).where(
            ProjectEnvironment.project_id == project_id
        )
    )


def environment_out(
    row: ProjectEnvironment | None, tools: EnvironmentTools
) -> EnvironmentOut:
    claude = shutil.which(tools.claude_command[0]) is not None
    if row is None:
        return EnvironmentOut(
            status="todo",
            container=None,
            image=None,
            workspace=None,
            port=None,
            error_code=None,
            log="",
            claude_available=claude,
        )
    return EnvironmentOut(
        status=row.status,
        container=row.container,
        image=row.image,
        workspace=row.workspace,
        port=row.port,
        error_code=row.error_code,
        log=row.log[-LOG_TAIL:],
        claude_available=claude,
    )


def start_environment(
    db: Session, project: Project, tools: EnvironmentTools
) -> None:
    row = current(db, project.id)
    if row is not None and row.status == EnvironmentStatus.BUILDING.value:
        raise AppError(409, "environment_busy")
    usable_token(db, project)
    if row is None:
        row = ProjectEnvironment(project_id=project.id)
        db.add(row)
    row.status = EnvironmentStatus.BUILDING.value
    row.error_code = None
    row.log = ""
    db.commit()
    bind = db.get_bind()
    tools.jobs.submit(lambda: build_environment(bind, project.id, tools))


def teardown(db: Session, project_id: int, docker: Docker) -> None:
    if current(db, project_id) is None:
        return
    try:
        docker.run("rm", "-f", container_name(project_id))
    except DockerError:
        pass


def mark_interrupted(db: Session) -> None:
    db.execute(
        update(ProjectEnvironment)
        .where(ProjectEnvironment.status == EnvironmentStatus.BUILDING.value)
        .values(
            status=EnvironmentStatus.FAILED.value, error_code="interrupted"
        )
    )
    db.commit()

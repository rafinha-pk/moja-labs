import shutil
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import runner
from app.agent.models import AgentRun, RunStatus
from app.clock import utcnow
from app.db import get_db
from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)

router = APIRouter(prefix="/projects/{project_id}/agent", tags=["agent"])

LISTED = 20
LOG_TAIL = 20000

Prompt = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)
]


class RunIn(BaseModel):
    kind: Literal["docs"]
    prompt: Prompt


class RunSummary(BaseModel):
    id: int
    kind: str
    prompt: str
    status: Literal["running", "done", "failed", "stopped"]
    error_code: str | None
    cost_usd: float | None
    created_at: datetime
    finished_at: datetime | None

    model_config = {"from_attributes": True}


class RunOut(RunSummary):
    log: str
    summary: str | None


def _run(db: Session, project_id: int, run_id: int) -> AgentRun:
    run = db.get(AgentRun, run_id)
    if run is None or run.project_id != project_id:
        raise AppError(404, "run_not_found")
    return run


def _out(run: AgentRun) -> RunOut:
    out = RunOut.model_validate(run)
    out.log = run.log[-LOG_TAIL:]
    return out


@router.get("/runs", response_model=list[RunSummary])
def list_runs(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return db.scalars(
        select(AgentRun)
        .where(AgentRun.project_id == access.project.id)
        .order_by(AgentRun.id.desc())
        .limit(LISTED)
    ).all()


@router.post("/runs", response_model=RunOut, status_code=201)
def start_run(
    body: RunIn,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    environment = current(db, project.id)
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
        or not environment.workspace
    ):
        raise AppError(409, "environment_not_ready")
    if shutil.which(tools.claude_command[0]) is None:
        raise AppError(409, "claude_unavailable")
    busy = db.scalar(
        select(AgentRun.id).where(
            AgentRun.project_id == project.id,
            AgentRun.status == RunStatus.RUNNING.value,
        )
    )
    if busy is not None:
        raise AppError(409, "agent_busy")
    run = AgentRun(
        project_id=project.id,
        user_id=access.user.id,
        kind=body.kind,
        prompt=body.prompt,
        status=RunStatus.RUNNING.value,
    )
    db.add(run)
    db.commit()
    bind = db.get_bind()
    run_id = run.id
    tools.jobs.submit(lambda: runner.execute(bind, run_id, tools))
    db.refresh(run)
    return _out(run)


@router.get("/runs/{run_id}", response_model=RunOut)
def read_run(
    run_id: int,
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
):
    return _out(_run(db, access.project.id, run_id))


@router.post("/runs/{run_id}/stop", response_model=RunOut)
def stop_run(
    run_id: int,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    run = _run(db, access.project.id, run_id)
    if run.status == RunStatus.RUNNING.value:
        run.status = RunStatus.STOPPED.value
        run.finished_at = utcnow()
        db.commit()
        process = runner.PROCESSES.get(run.id)
        if process is not None:
            runner.kill(process)
    return _out(run)

import json
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import runner
from app.agent.models import AgentRun, RunStatus
from app.agent.service import ensure_idle, purge_runs, start_run
from app.clock import utcnow
from app.db import get_db
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

Kind = Literal["docs", "tasks"]
ListedKind = Literal["docs", "tasks", "commit"]
Prompt = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=8000),
]


class RunIn(BaseModel):
    kind: Kind
    prompt: Prompt
    new_conversation: bool = False


class RunSummary(BaseModel):
    id: int
    kind: str
    prompt: str
    status: Literal["running", "done", "failed", "stopped"]
    summary: str | None
    output: dict | None
    from_docs: bool
    resumed_from: int | None
    error_code: str | None
    created_at: datetime
    finished_at: datetime | None

    model_config = {"from_attributes": True}

    @field_validator("output", mode="before")
    @classmethod
    def parse_output(cls, value: object) -> object:
        return json.loads(value) if isinstance(value, str) else value


class RunOut(RunSummary):
    log: str


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
    kind: ListedKind = "docs",
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(AgentRun)
        .where(AgentRun.project_id == access.project.id, AgentRun.kind == kind)
        .order_by(AgentRun.id.desc())
        .limit(LISTED)
    ).all()


@router.post("/runs", response_model=RunOut, status_code=201)
def create_run(
    body: RunIn,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    run = start_run(
        db,
        access.project,
        access.user,
        body.kind,
        body.prompt,
        tools,
        body.new_conversation,
    )
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


@router.delete("/runs", status_code=204)
def clear_runs(
    kind: ListedKind = "docs",
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    ensure_idle(db, access.project.id)
    purge_runs(db, access.project.id, tools.claude_home, kind)
    return Response(status_code=204)

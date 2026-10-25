import re
import shutil
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.agent import runner
from app.agent.models import AgentRun, RunStatus
from app.clock import utcnow
from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.environments.tools import EnvironmentTools
from app.errors import AppError
from app.projects.models import Project
from app.tasks.service import existing_tasks_text
from app.users.models import User


def mark_interrupted(db: Session) -> None:
    db.execute(
        update(AgentRun)
        .where(AgentRun.status == RunStatus.RUNNING.value)
        .values(
            status=RunStatus.FAILED.value,
            error_code="interrupted",
            finished_at=utcnow(),
        )
    )
    db.commit()


SESSION_ID = re.compile(r"[0-9A-Za-z-]{8,64}")


def _forget_session(claude_home: Path, session_id: str) -> None:
    if not SESSION_ID.fullmatch(session_id):
        return
    projects = claude_home / "projects"
    for transcript in projects.glob(f"*/{session_id}.jsonl"):
        transcript.unlink(missing_ok=True)
    for extras in projects.glob(f"*/{session_id}"):
        shutil.rmtree(extras, ignore_errors=True)


def purge_runs(
    db: Session, project_id: int, claude_home: Path, kind: str | None = None
) -> None:
    runs = select(AgentRun).where(AgentRun.project_id == project_id)
    if kind is not None:
        runs = runs.where(AgentRun.kind == kind)
    sessions = {
        run.session_id for run in db.scalars(runs) if run.session_id
    }
    for session_id in sessions:
        _forget_session(claude_home, session_id)
    delete_runs = delete(AgentRun).where(AgentRun.project_id == project_id)
    if kind is not None:
        delete_runs = delete_runs.where(AgentRun.kind == kind)
    db.execute(delete_runs)
    db.commit()


def ensure_idle(db: Session, project_id: int) -> None:
    busy = db.scalar(
        select(AgentRun.id).where(
            AgentRun.project_id == project_id,
            AgentRun.status == RunStatus.RUNNING.value,
        )
    )
    if busy is not None:
        raise AppError(409, "agent_busy")


def run_settings(
    project: Project, kind: str, tools: EnvironmentTools
) -> tuple[str, str, bool]:
    if kind == "tasks":
        return (
            project.tasks_model,
            project.tasks_effort,
            project.tasks_thinking,
        )
    return tools.agent_model, tools.agent_effort, False


def start_run(
    db: Session,
    project: Project,
    user: User,
    kind: str,
    prompt: str,
    tools: EnvironmentTools,
    new_conversation: bool,
    head_commit: str | None = None,
) -> AgentRun:
    environment = current(db, project.id)
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
        or not environment.workspace
    ):
        raise AppError(409, "environment_not_ready")
    if shutil.which(tools.claude_command[0]) is None:
        raise AppError(409, "claude_unavailable")
    ensure_idle(db, project.id)
    previous = None
    if new_conversation:
        purge_runs(db, project.id, tools.claude_home, kind)
    else:
        previous = db.scalar(
            select(AgentRun)
            .where(
                AgentRun.project_id == project.id,
                AgentRun.kind == kind,
                AgentRun.status == RunStatus.DONE.value,
                AgentRun.session_id.is_not(None),
            )
            .order_by(AgentRun.id.desc())
            .limit(1)
        )
    if kind == "tasks" and previous is None and head_commit is None:
        prompt = (
            f"Existing tasks (do not duplicate them):\n"
            f"{existing_tasks_text(db, project.id)}\n\nRequest:\n{prompt}"
        )
    model, effort, thinking = run_settings(project, kind, tools)
    run = AgentRun(
        project_id=project.id,
        user_id=user.id,
        kind=kind,
        prompt=prompt,
        status=RunStatus.RUNNING.value,
        resumed_from=previous.id if previous else None,
        head_commit=head_commit or (previous.head_commit if previous else None),
        model=model,
        effort=effort,
        thinking=thinking,
    )
    db.add(run)
    db.commit()
    bind = db.get_bind()
    run_id = run.id
    tools.jobs.submit(lambda: runner.execute(bind, run_id, tools))
    db.refresh(run)
    return run

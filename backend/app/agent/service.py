import re
import shutil
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.agent import runner
from app.agent.models import AgentRun, RunStatus
from app.clock import utcnow
from app.environments.builder import container_name
from app.environments.docker import DockerError
from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.environments.tools import EnvironmentTools
from app.members.access import member_specialty
from app.errors import AppError
from app.projects.models import Project
from app.tasks.models import Task, TaskStatus
from app.tasks.service import existing_tasks_text, task_prompt
from app.users.models import User

SESSION_ID = re.compile(r"[0-9A-Za-z-]{8,64}")


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
    db.execute(
        update(Task)
        .where(Task.status == TaskStatus.DOING.value)
        .values(status=TaskStatus.FAILED.value)
    )
    db.execute(
        update(Task)
        .where(Task.status == TaskStatus.QUEUED.value)
        .values(status=TaskStatus.TODO.value)
    )
    db.commit()


def _forget_session(claude_home: Path, session_id: str) -> None:
    if not SESSION_ID.fullmatch(session_id):
        return
    projects = claude_home / "projects"
    for transcript in projects.glob(f"*/{session_id}.jsonl"):
        transcript.unlink(missing_ok=True)
    for extras in projects.glob(f"*/{session_id}"):
        shutil.rmtree(extras, ignore_errors=True)


def _purge(db: Session, scope: list, claude_home: Path) -> None:
    runs = select(AgentRun)
    deletion = delete(AgentRun)
    for condition in scope:
        runs = runs.where(condition)
        deletion = deletion.where(condition)
    sessions = {run.session_id for run in db.scalars(runs) if run.session_id}
    for session_id in sessions:
        _forget_session(claude_home, session_id)
    db.execute(deletion)
    db.commit()


def purge_runs(
    db: Session, project_id: int, claude_home: Path, kind: str | None = None
) -> None:
    scope = [AgentRun.project_id == project_id]
    if kind is not None:
        scope.append(AgentRun.kind == kind)
    _purge(db, scope, claude_home)


def purge_task_runs(db: Session, task_id: int, claude_home: Path) -> None:
    _purge(db, [AgentRun.task_id == task_id], claude_home)


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
    project: Project,
    kind: str,
    tools: EnvironmentTools,
    task: Task | None = None,
) -> tuple[str, str, bool]:
    if kind in ("tasks", "task"):
        override = task or Task()
        return (
            override.model or project.tasks_model,
            override.effort or project.tasks_effort,
            project.tasks_thinking
            if override.thinking is None
            else override.thinking,
        )
    return tools.agent_model, tools.agent_effort, False


def _previous_run(db: Session, project_id: int, kind: str) -> AgentRun | None:
    return db.scalar(
        select(AgentRun)
        .where(
            AgentRun.project_id == project_id,
            AgentRun.kind == kind,
            AgentRun.status == RunStatus.DONE.value,
            AgentRun.session_id.is_not(None),
        )
        .order_by(AgentRun.id.desc())
        .limit(1)
    )


def preflight(db: Session, project: Project, tools: EnvironmentTools) -> None:
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


def create_run(
    db: Session,
    project: Project,
    user: User,
    kind: str,
    prompt: str,
    tools: EnvironmentTools,
    new_conversation: bool,
    docs_snapshot: str | None = None,
    task: Task | None = None,
) -> AgentRun:
    preflight(db, project, tools)
    previous = None
    if task is not None:
        try:
            tools.docker.run("start", container_name(project.id))
        except DockerError:
            raise AppError(502, "docker_unavailable") from None
        purge_task_runs(db, task.id, tools.claude_home)
        prompt = task_prompt(task)
        task.status = TaskStatus.DOING.value
    elif new_conversation:
        purge_runs(db, project.id, tools.claude_home, kind)
    else:
        previous = _previous_run(db, project.id, kind)
    if kind == "tasks" and previous is None and docs_snapshot is None:
        prompt = (
            "Existing tasks (do not duplicate them):\n"
            f"{existing_tasks_text(db, project.id)}\n\nRequest:\n{prompt}"
        )
    model, effort, thinking = run_settings(project, kind, tools, task)
    run = AgentRun(
        project_id=project.id,
        user_id=user.id,
        task_id=task.id if task else None,
        scope=member_specialty(db, project.id, user) if task else None,
        kind=kind,
        prompt=prompt,
        status=RunStatus.RUNNING.value,
        resumed_from=previous.id if previous else None,
        docs_snapshot=docs_snapshot
        or (previous.docs_snapshot if previous else None),
        model=model,
        effort=effort,
        thinking=thinking,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def start_run(
    db: Session,
    project: Project,
    user: User,
    kind: str,
    prompt: str,
    tools: EnvironmentTools,
    new_conversation: bool,
    docs_snapshot: str | None = None,
    task: Task | None = None,
) -> AgentRun:
    run = create_run(
        db,
        project,
        user,
        kind,
        prompt,
        tools,
        new_conversation,
        docs_snapshot,
        task,
    )
    bind = db.get_bind()
    run_id = run.id
    tools.jobs.submit(lambda: runner.execute(bind, run_id, tools))
    db.commit()
    db.refresh(run)
    return run

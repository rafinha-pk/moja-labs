from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.agent import runner
from app.agent.models import AgentRun, RunStatus
from app.agent.router import RunOut, _out
from app.agent.service import create_run, preflight, start_run
from app.clock import utcnow
from app.db import get_db
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_run_project,
    can_view_project,
)
from app.projects.models import Project
from app.tasks import service
from app.tasks.models import Task, TaskStatus
from app.tasks.router import _find, find_allowed
from app.tasks.schemas import TaskOut
from app.users.models import User

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

BUSY = (TaskStatus.QUEUED.value, TaskStatus.DOING.value)


def _dequeue(db: Session, project_id: int) -> None:
    db.execute(
        update(Task)
        .where(
            Task.project_id == project_id,
            Task.status == TaskStatus.QUEUED.value,
        )
        .values(status=TaskStatus.TODO.value)
    )
    db.commit()


def run_queue(
    bind: Engine, project_id: int, user_id: int, tools: EnvironmentTools
) -> None:
    while True:
        with Session(bind) as db:
            task = db.scalar(
                select(Task)
                .where(
                    Task.project_id == project_id,
                    Task.status == TaskStatus.QUEUED.value,
                )
                .order_by(Task.position, Task.id)
                .limit(1)
            )
            if task is None:
                return
            task_id = task.id
            try:
                run = create_run(
                    db,
                    db.get(Project, project_id),
                    db.get(User, user_id),
                    "task",
                    "",
                    tools,
                    True,
                    task=task,
                )
            except AppError:
                _dequeue(db, project_id)
                return
            run_id = run.id
        runner.execute(bind, run_id, tools)
        with Session(bind) as db:
            if db.get(Task, task_id).status != TaskStatus.DONE.value:
                _dequeue(db, project_id)
                return


@router.post("/execute-all", response_model=list[TaskOut], status_code=202)
def execute_all(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    tasks = service.project_tasks(db, project.id, archived=False)
    if any(task.status in BUSY for task in tasks):
        raise AppError(409, "task_busy")
    pending = [
        task
        for task in tasks
        if task.status == TaskStatus.TODO.value and task.area in access.areas
    ]
    if not pending:
        raise AppError(409, "nothing_to_execute")
    preflight(db, project, tools)
    for task in pending:
        task.status = TaskStatus.QUEUED.value
    db.commit()
    bind = db.get_bind()
    user_id = access.user.id
    tools.jobs.submit(lambda: run_queue(bind, project.id, user_id, tools))
    db.commit()
    db.expire_all()
    return service.tasks_out(db, service.project_tasks(db, project.id))


@router.post("/stop", response_model=list[TaskOut])
def stop_execution(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
):
    project = access.project
    _dequeue(db, project.id)
    running = db.scalar(
        select(AgentRun).where(
            AgentRun.project_id == project.id,
            AgentRun.kind == "task",
            AgentRun.status == RunStatus.RUNNING.value,
        )
    )
    if running is not None:
        running.status = RunStatus.STOPPED.value
        running.finished_at = utcnow()
        task = db.get(Task, running.task_id) if running.task_id else None
        if task is not None and task.status == TaskStatus.DOING.value:
            task.status = TaskStatus.TODO.value
        db.commit()
        process = runner.PROCESSES.get(running.id)
        if process is not None:
            runner.kill(process)
    db.commit()
    db.expire_all()
    return service.tasks_out(db, service.project_tasks(db, project.id))


@router.post("/{task_id}/execute", response_model=TaskOut, status_code=202)
def execute_task(
    task_id: int,
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    task = find_allowed(db, access, task_id)
    if task.status in BUSY:
        raise AppError(409, "task_busy")
    start_run(
        db,
        access.project,
        access.user,
        "task",
        "",
        tools,
        True,
        task=task,
    )
    db.commit()
    db.expire_all()
    return service.tasks_out(db, [find_allowed(db, access, task_id)])[0]


@router.get("/{task_id}/run", response_model=RunOut)
def read_task_run(
    task_id: int,
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
):
    task = _find(db, access.project.id, task_id)
    run = db.scalar(
        select(AgentRun)
        .where(AgentRun.task_id == task.id)
        .order_by(AgentRun.id.desc())
        .limit(1)
    )
    if run is None:
        raise AppError(404, "run_not_found")
    return _out(run)

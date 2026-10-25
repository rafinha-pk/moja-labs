from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.agent.service import purge_task_runs
from app.db import get_db
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)
from app.setup.service import setup_complete
from app.tasks import service
from app.tasks.models import Task, TaskStatus
from app.tasks.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

OPTIONAL_FIELDS = ("model", "effort", "thinking")


def _find(db: Session, project_id: int, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.project_id != project_id:
        raise AppError(404, "task_not_found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return service.tasks_out(db, service.project_tasks(db, access.project.id))


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreate,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    if not setup_complete(db, access.project):
        raise AppError(409, "setup_incomplete")
    task = service.create_task(
        db, access.project.id, body.title, body.description or None
    )
    db.commit()
    return service.tasks_out(db, [task])[0]


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    body: TaskUpdate,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    task = _find(db, access.project.id, task_id)
    if body.title is not None:
        task.title = body.title
    if "description" in body.model_fields_set:
        task.description = body.description or None
    if body.status is not None:
        task.status = body.status.value
    for field in OPTIONAL_FIELDS:
        if field in body.model_fields_set:
            setattr(task, field, getattr(body, field))
    db.commit()
    return service.tasks_out(db, [task])[0]


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    task = _find(db, access.project.id, task_id)
    if task.status in (TaskStatus.QUEUED.value, TaskStatus.DOING.value):
        raise AppError(409, "task_busy")
    purge_task_runs(db, task.id, tools.claude_home)
    db.delete(task)
    db.commit()
    return Response(status_code=204)

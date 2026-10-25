from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)
from app.setup.service import setup_complete
from app.tasks import service
from app.tasks.models import StageKey, Task, TaskStage
from app.tasks.schemas import (
    StageUpdate,
    TaskCreate,
    TaskOut,
    TaskStageOut,
    TaskUpdate,
)

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


def _out(task: Task, stages: list[TaskStage]) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        status=service.derive_status([stage.status for stage in stages]),
        stages=[TaskStageOut.model_validate(stage) for stage in stages],
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _find(db: Session, project_id: int, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.project_id != project_id:
        raise AppError(404, "task_not_found")
    return task


def _single(db: Session, task: Task) -> TaskOut:
    return _out(task, service.stages_by_task(db, [task.id])[task.id])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.project_id == access.project.id)
            .order_by(Task.id)
        )
    )
    stages = service.stages_by_task(db, [task.id for task in tasks])
    return [_out(task, stages[task.id]) for task in tasks]


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
    return _single(db, task)


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
    db.commit()
    return _single(db, task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    db.delete(_find(db, access.project.id, task_id))
    db.commit()
    return Response(status_code=204)


@router.patch("/{task_id}/stages/{key}", response_model=TaskOut)
def update_stage(
    task_id: int,
    key: StageKey,
    body: StageUpdate,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    task = _find(db, access.project.id, task_id)
    stage = db.scalar(
        select(TaskStage).where(
            TaskStage.task_id == task.id, TaskStage.key == key.value
        )
    )
    stage.status = body.status.value
    db.commit()
    return _single(db, task)

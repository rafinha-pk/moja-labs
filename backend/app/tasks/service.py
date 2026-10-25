from sqlalchemy import case, exists, func, select
from sqlalchemy.orm import Session

from app.tasks.models import (
    OPEN_STATUSES,
    StageKey,
    StageStatus,
    Task,
    TaskStage,
)


def create_task(
    db: Session, project_id: int, title: str, description: str | None
) -> Task:
    task = Task(project_id=project_id, title=title, description=description)
    db.add(task)
    db.flush()
    for position, key in enumerate(StageKey):
        db.add(TaskStage(task_id=task.id, key=key.value, position=position))
    return task


def derive_status(statuses: list[str]) -> str:
    if all(status == StageStatus.TODO.value for status in statuses):
        return StageStatus.TODO.value
    if any(status in OPEN_STATUSES for status in statuses):
        return StageStatus.DOING.value
    return StageStatus.DONE.value


def stages_by_task(
    db: Session, task_ids: list[int]
) -> dict[int, list[TaskStage]]:
    grouped: dict[int, list[TaskStage]] = {task_id: [] for task_id in task_ids}
    rows = db.scalars(
        select(TaskStage)
        .where(TaskStage.task_id.in_(task_ids))
        .order_by(TaskStage.task_id, TaskStage.position)
    )
    for stage in rows:
        grouped[stage.task_id].append(stage)
    return grouped


def task_counts(
    db: Session, project_ids: list[int]
) -> dict[int, tuple[int, int]]:
    still_open = exists().where(
        TaskStage.task_id == Task.id, TaskStage.status.in_(OPEN_STATUSES)
    )
    finished = case((~still_open, 1), else_=0)
    rows = db.execute(
        select(Task.project_id, func.count(), func.sum(finished))
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.project_id)
    )
    return {pid: (total, int(done)) for pid, total, done in rows}

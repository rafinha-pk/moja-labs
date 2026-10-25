from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.tasks.models import Task, TaskSource, TaskStatus

TITLE_LIMIT = 150
LISTED_IN_PROMPT = 100


def create_task(
    db: Session,
    project_id: int,
    title: str,
    description: str | None,
    source: TaskSource = TaskSource.MANUAL,
) -> Task:
    last = db.scalar(
        select(func.max(Task.position)).where(Task.project_id == project_id)
    )
    task = Task(
        project_id=project_id,
        title=title[:TITLE_LIMIT],
        description=description,
        position=(last or 0) + 1,
        source=source.value,
        status=TaskStatus.TODO.value,
    )
    db.add(task)
    db.flush()
    return task


def project_tasks(db: Session, project_id: int) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .where(Task.project_id == project_id)
            .order_by(Task.position, Task.id)
        )
    )


def task_counts(
    db: Session, project_ids: list[int]
) -> dict[int, tuple[int, int]]:
    finished = func.sum(case((Task.status == TaskStatus.DONE.value, 1), else_=0))
    rows = db.execute(
        select(Task.project_id, func.count(), finished)
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.project_id)
    )
    return {pid: (total, int(done)) for pid, total, done in rows}


def existing_tasks_text(db: Session, project_id: int) -> str:
    lines = [
        f"- [{task.status}] {task.title}"
        for task in project_tasks(db, project_id)[:LISTED_IN_PROMPT]
    ]
    return "\n".join(lines) if lines else "(none yet)"

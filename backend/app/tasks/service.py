from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.agent.models import AgentRun
from app.tasks.models import Task, TaskSource, TaskStatus
from app.tasks.schemas import TaskOut

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
    finished = func.sum(
        case((Task.status == TaskStatus.DONE.value, 1), else_=0)
    )
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


def task_prompt(task: Task) -> str:
    description = f"\n\n{task.description}" if task.description else ""
    return (
        f"Implement this task in the project.\n\n# {task.title}{description}"
        "\n\nRead CLAUDE.md first. The project documentation is in docs/ "
        "and README.md; read what you need. Run project code only through "
        "the docker exec prefix and keep the work inside the project "
        "folder. Do not commit or push. When you finish, answer with a "
        "short summary: what changed, what you ran to check it and "
        "anything left."
    )


def tasks_out(db: Session, tasks: list[Task]) -> list[TaskOut]:
    latest = dict(
        db.execute(
            select(AgentRun.task_id, func.max(AgentRun.id))
            .where(AgentRun.task_id.in_([task.id for task in tasks]))
            .group_by(AgentRun.task_id)
        ).all()
    )
    return [
        TaskOut.model_validate(task).model_copy(
            update={"run_id": latest.get(task.id)}
        )
        for task in tasks
    ]

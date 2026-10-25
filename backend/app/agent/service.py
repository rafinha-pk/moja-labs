from sqlalchemy import update
from sqlalchemy.orm import Session

from app.agent.models import AgentRun, RunStatus
from app.clock import utcnow


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

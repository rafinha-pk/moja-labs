from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DocSnapshot(Base):
    __tablename__ = "doc_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "path", name="uq_doc_snapshots_project_path"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    path: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(LONGTEXT)

"""tasks from docs

Revision ID: 0c4e756f9ac0
Revises: c9d872693afc
Create Date: 2026-10-25 01:59:09.702842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c4e756f9ac0'
down_revision: Union[str, Sequence[str], None] = 'c9d872693afc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("status", sa.String(length=10), server_default="todo", nullable=False),
    )
    op.add_column(
        "tasks", sa.Column("position", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column(
        "tasks",
        sa.Column("source", sa.String(length=10), server_default="manual", nullable=False),
    )
    op.add_column("tasks", sa.Column("model", sa.String(length=40), nullable=True))
    op.add_column("tasks", sa.Column("effort", sa.String(length=10), nullable=True))
    op.add_column("tasks", sa.Column("thinking", sa.Boolean(), nullable=True))
    op.execute("UPDATE tasks SET position = id")
    op.execute(
        "UPDATE tasks SET status = 'doing' WHERE EXISTS (SELECT 1 FROM task_stages s "
        "WHERE s.task_id = tasks.id AND s.status IN ('todo', 'doing')) "
        "AND EXISTS (SELECT 1 FROM task_stages s WHERE s.task_id = tasks.id "
        "AND s.status IN ('doing', 'done', 'skipped'))"
    )
    op.execute(
        "UPDATE tasks SET status = 'done' WHERE NOT EXISTS (SELECT 1 FROM task_stages s "
        "WHERE s.task_id = tasks.id AND s.status IN ('todo', 'doing')) "
        "AND EXISTS (SELECT 1 FROM task_stages s WHERE s.task_id = tasks.id)"
    )
    op.drop_table("task_stages")
    op.alter_column("tasks", "status", server_default=None, existing_type=sa.String(length=10), existing_nullable=False)
    op.alter_column("tasks", "position", server_default=None, existing_type=sa.Integer(), existing_nullable=False)
    op.alter_column("tasks", "source", server_default=None, existing_type=sa.String(length=10), existing_nullable=False)

    op.add_column("projects", sa.Column("tasks_base_commit", sa.String(length=40), nullable=True))
    op.add_column(
        "projects",
        sa.Column("tasks_model", sa.String(length=40), server_default="claude-sonnet-5-5", nullable=False),
    )
    op.add_column(
        "projects",
        sa.Column("tasks_effort", sa.String(length=10), server_default="medium", nullable=False),
    )
    op.add_column(
        "projects",
        sa.Column("tasks_thinking", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    for column in ("tasks_model", "tasks_effort"):
        op.alter_column("projects", column, server_default=None, existing_type=sa.String(length=40), existing_nullable=False)
    op.alter_column("projects", "tasks_thinking", server_default=None, existing_type=sa.Boolean(), existing_nullable=False)

    op.add_column(
        "agent_runs",
        sa.Column("model", sa.String(length=40), server_default="claude-sonnet-5-5", nullable=False),
    )
    op.add_column(
        "agent_runs",
        sa.Column("effort", sa.String(length=10), server_default="medium", nullable=False),
    )
    op.add_column(
        "agent_runs",
        sa.Column("thinking", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("agent_runs", sa.Column("head_commit", sa.String(length=40), nullable=True))
    op.add_column("agent_runs", sa.Column("output", sa.Text(), nullable=True))
    for column in ("model", "effort"):
        op.alter_column("agent_runs", column, server_default=None, existing_type=sa.String(length=40), existing_nullable=False)
    op.alter_column("agent_runs", "thinking", server_default=None, existing_type=sa.Boolean(), existing_nullable=False)


def downgrade() -> None:
    raise NotImplementedError("the task stages cannot be rebuilt")

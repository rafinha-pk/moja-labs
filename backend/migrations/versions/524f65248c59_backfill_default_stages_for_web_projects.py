"""backfill default stages for web projects

Revision ID: 524f65248c59
Revises: 5dc4d8c08a8f
Create Date: 2026-10-24 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '524f65248c59'
down_revision: Union[str, Sequence[str], None] = '5dc4d8c08a8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BACKFILL = """
INSERT INTO project_stages
    (project_id, `key`, status, position, created_at, updated_at)
SELECT p.id, d.stage_key, 'todo', d.position,
       UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM projects p
JOIN (
    SELECT 'database' AS stage_key, 0 AS position
    UNION ALL SELECT 'auth', 1
    UNION ALL SELECT 'screens', 2
    UNION ALL SELECT 'deploy', 3
) d
WHERE p.type = 'web'
  AND NOT EXISTS (SELECT 1 FROM project_stages s WHERE s.project_id = p.id)
"""


def upgrade() -> None:
    op.execute(sa.text(BACKFILL))


def downgrade() -> None:
    pass

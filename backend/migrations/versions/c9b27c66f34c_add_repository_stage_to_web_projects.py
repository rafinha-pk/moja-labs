"""add repository stage to web projects

Revision ID: c9b27c66f34c
Revises: 1ac8c5b4055e
Create Date: 2026-10-24 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9b27c66f34c'
down_revision: Union[str, Sequence[str], None] = '1ac8c5b4055e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MISSING = """
FROM projects p
WHERE p.type = 'web'
  AND NOT EXISTS (
      SELECT 1 FROM project_stages s
      WHERE s.project_id = p.id AND s.`key` = 'repository'
  )
"""

SHIFT = f"""
UPDATE project_stages s
JOIN projects p ON p.id = s.project_id
SET s.position = s.position + 1
WHERE p.type = 'web'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT project_id, `key` FROM project_stages) r
      WHERE r.project_id = p.id AND r.`key` = 'repository'
  )
"""

INSERT = f"""
INSERT INTO project_stages
    (project_id, `key`, status, position, created_at, updated_at)
SELECT p.id, 'repository',
       CASE WHEN EXISTS (
           SELECT 1 FROM project_repositories r WHERE r.project_id = p.id
       ) THEN 'done' ELSE 'todo' END,
       0, UTC_TIMESTAMP(), UTC_TIMESTAMP()
{MISSING}
"""


def upgrade() -> None:
    op.execute(sa.text(SHIFT))
    op.execute(sa.text(INSERT))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM project_stages WHERE `key` = 'repository'"))

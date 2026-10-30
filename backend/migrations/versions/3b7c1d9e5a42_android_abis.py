"""android abis

Revision ID: 3b7c1d9e5a42
Revises: 085c4d45d7c4
Create Date: 2026-10-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3b7c1d9e5a42'
down_revision: Union[str, Sequence[str], None] = '085c4d45d7c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('android_abis', sa.String(length=60), server_default='arm64-v8a', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('projects', 'android_abis')

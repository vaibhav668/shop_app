"""movement times use clock_timestamp

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-29 23:34:31.537463
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Several movements written in one transaction keep their real order (now() is fixed
    # for the whole transaction; clock_timestamp() is the actual time of each insert).
    op.alter_column(
        "inventory_movements", "created_at", server_default=sa.text("clock_timestamp()")
    )


def downgrade() -> None:
    op.alter_column("inventory_movements", "created_at", server_default=sa.text("now()"))

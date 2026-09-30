"""shop delivery eta minutes

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-30 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The delivery promise shown in the app ("30 min"), set by the shop owner.
    op.add_column(
        "shop_settings",
        sa.Column("delivery_eta_minutes", sa.Integer(), nullable=False, server_default="30"),
    )
    op.create_check_constraint(
        op.f("ck_shop_settings_delivery_eta_minutes_range"),
        "shop_settings",
        "delivery_eta_minutes BETWEEN 5 AND 240",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_shop_settings_delivery_eta_minutes_range"), "shop_settings", type_="check"
    )
    op.drop_column("shop_settings", "delivery_eta_minutes")

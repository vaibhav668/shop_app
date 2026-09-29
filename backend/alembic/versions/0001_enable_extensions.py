"""enable postgres extensions

pg_trgm powers product search; citext gives case-insensitive emails.
Both are trusted extensions (PG13+), so the database owner can create them.

Revision ID: 0001
Revises:
Create Date: 2026-09-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS citext")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")

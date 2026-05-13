"""add wealth_item_uuid to accounts and assets

Revision ID: 0006_wealth_item_uuid
Revises: 0005_enable_banking_schema, 0005_enable_banking_columns
Create Date: 2026-05-13

Adds a nullable, non-indexed wealth_item_uuid column on both `accounts`
and `assets` tables. Prepares future Option B unification (one wealth_items
table) without locking us in — column stays NULL until we activate it.

Also merges the two parallel 0005 heads (enable_banking_schema and
enable_banking_columns) into a single head.

Defensive: IF NOT EXISTS so re-running against a DB already patched by the
lightweight ALTER hook in main.py is a no-op.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '0006_wealth_item_uuid'
down_revision: Union[str, Sequence[str], None] = (
    '0005_enable_banking_schema',
    '0005_enable_banking_columns',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wealth_item_uuid VARCHAR")
    op.execute("ALTER TABLE assets   ADD COLUMN IF NOT EXISTS wealth_item_uuid VARCHAR")


def downgrade() -> None:
    op.execute("ALTER TABLE accounts DROP COLUMN IF EXISTS wealth_item_uuid")
    op.execute("ALTER TABLE assets   DROP COLUMN IF EXISTS wealth_item_uuid")

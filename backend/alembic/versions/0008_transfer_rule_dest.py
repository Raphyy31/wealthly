"""add transfer_dest_account_id to categorisation_rules

Revision ID: 0008_transfer_rule_dest
Revises: 0007_asset_parent
"""
from alembic import op

revision = '0008_transfer_rule_dest'
down_revision = '0007_asset_parent'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS transfer_dest_account_id VARCHAR")


def downgrade():
    op.execute("ALTER TABLE categorisation_rules DROP COLUMN IF EXISTS transfer_dest_account_id")

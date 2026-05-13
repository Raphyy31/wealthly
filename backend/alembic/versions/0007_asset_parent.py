"""add parent_asset_id to assets

Revision ID: 0007_asset_parent
Revises: 0006_wealth_item_uuid
"""
from alembic import op

revision = '0007_asset_parent'
down_revision = '0006_wealth_item_uuid'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id VARCHAR")
    op.execute("CREATE INDEX IF NOT EXISTS ix_assets_parent_asset_id ON assets (parent_asset_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_assets_parent_asset_id")
    op.execute("ALTER TABLE assets DROP COLUMN IF EXISTS parent_asset_id")

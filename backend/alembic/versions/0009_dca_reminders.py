"""add reminder fields to dca_plans

Revision ID: 0009_dca_reminders
Revises: 0008_transfer_rule_dest
"""
from alembic import op

revision = '0009_dca_reminders'
down_revision = '0008_transfer_rule_dest'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE dca_plans ADD COLUMN IF NOT EXISTS reminder_email_enabled BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE dca_plans ADD COLUMN IF NOT EXISTS reminder_lead_days INTEGER NOT NULL DEFAULT 2")


def downgrade():
    op.execute("ALTER TABLE dca_plans DROP COLUMN IF EXISTS reminder_lead_days")
    op.execute("ALTER TABLE dca_plans DROP COLUMN IF EXISTS reminder_email_enabled")

"""add review_status to transactions

Revision ID: 0010_tx_review_status
Revises: 0009_dca_reminders
"""
from alembic import op

revision = '0010_tx_review_status'
down_revision = '0009_dca_reminders'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS review_status VARCHAR")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transactions_review_status ON transactions (review_status)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_transactions_review_status")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS review_status")

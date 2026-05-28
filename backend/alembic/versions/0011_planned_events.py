"""add planned_events table

Revision ID: 0011_planned_events
Revises: 0010_tx_review_status
"""
from alembic import op

revision = '0011_planned_events'
down_revision = '0010_tx_review_status'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS planned_events (
            id VARCHAR PRIMARY KEY,
            household_id VARCHAR NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            label VARCHAR NOT NULL,
            amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            direction VARCHAR NOT NULL DEFAULT 'out',
            date DATE NOT NULL,
            account_id VARCHAR REFERENCES accounts(id) ON DELETE SET NULL,
            category_slug VARCHAR,
            notes TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_planned_events_household_id ON planned_events (household_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planned_events_date ON planned_events (date)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_planned_events_date")
    op.execute("DROP INDEX IF EXISTS ix_planned_events_household_id")
    op.execute("DROP TABLE IF EXISTS planned_events")

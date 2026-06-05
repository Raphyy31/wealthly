"""add documents table (coffre-fort)

Revision ID: 0012_documents
Revises: 0011_planned_events
"""
from alembic import op

revision = '0012_documents'
down_revision = '0011_planned_events'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR PRIMARY KEY,
            household_id VARCHAR NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            filename VARCHAR NOT NULL,
            content_type VARCHAR NOT NULL DEFAULT 'application/octet-stream',
            size_bytes INTEGER NOT NULL DEFAULT 0,
            category VARCHAR,
            account_id VARCHAR REFERENCES accounts(id) ON DELETE SET NULL,
            asset_id VARCHAR REFERENCES assets(id) ON DELETE SET NULL,
            notes TEXT,
            data BYTEA NOT NULL,
            created_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_household_id ON documents (household_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_documents_household_id")
    op.execute("DROP TABLE IF EXISTS documents")

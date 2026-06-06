"""add notifications table (moteur d'alertes)

Revision ID: 0014_notifications
Revises: 0013_enable_rls
"""
from alembic import op

revision = '0014_notifications'
down_revision = '0013_enable_rls'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR PRIMARY KEY,
            household_id VARCHAR NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            dedup_key VARCHAR NOT NULL,
            kind VARCHAR NOT NULL,
            severity VARCHAR NOT NULL DEFAULT 'info',
            title VARCHAR NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            data JSONB NOT NULL DEFAULT '{}',
            link VARCHAR,
            status VARCHAR NOT NULL DEFAULT 'unread',
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            CONSTRAINT uq_notif_dedup UNIQUE (household_id, dedup_key)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_household_id ON notifications (household_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notif_household_status ON notifications (household_id, status)")

    # RLS — cohérent avec 0013 (table scoped foyer).
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE notifications FORCE ROW LEVEL SECURITY")
        op.execute("DROP POLICY IF EXISTS notifications_household_isolation ON notifications")
        op.execute("""
            CREATE POLICY notifications_household_isolation ON notifications
            AS RESTRICTIVE FOR ALL
            USING (household_id = current_setting('app.current_household_id', true))
            WITH CHECK (household_id = current_setting('app.current_household_id', true))
        """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS notifications")

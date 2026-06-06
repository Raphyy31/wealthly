"""add ai_state table (cache Coach + plafond mensuel IA par foyer)

Revision ID: 0015_ai_state
Revises: 0014_notifications
"""
from alembic import op

revision = '0015_ai_state'
down_revision = '0014_notifications'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_state (
            household_id VARCHAR PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
            period VARCHAR,
            month_count INTEGER NOT NULL DEFAULT 0,
            coach_cache JSONB,
            coach_cached_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE ai_state ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE ai_state FORCE ROW LEVEL SECURITY")
        op.execute("DROP POLICY IF EXISTS ai_state_household_isolation ON ai_state")
        op.execute("""
            CREATE POLICY ai_state_household_isolation ON ai_state
            AS RESTRICTIVE FOR ALL
            USING (household_id = current_setting('app.current_household_id', true))
            WITH CHECK (household_id = current_setting('app.current_household_id', true))
        """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS ai_state")

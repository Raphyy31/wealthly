"""RLS policies for account/asset/liability member association tables.

The association tables do not carry a household_id column. Their tenant is
derived from both referenced rows, so a regular household_id policy cannot be
used. Production had RLS enabled without a usable INSERT policy, which blocked
account ownership changes and GoCardless account creation.

Revision ID: 0016_association_rls
Revises: 0015_ai_state
"""
from alembic import op


revision = "0016_association_rls"
down_revision = "0015_ai_state"
branch_labels = None
depends_on = None


ASSOCIATIONS = {
    "account_members": ("account_id", "accounts"),
    "asset_members": ("asset_id", "assets"),
    "liability_members": ("liability_id", "liabilities"),
}


def _household_check(item_column: str, item_table: str) -> str:
    return f"""
        EXISTS (
            SELECT 1 FROM {item_table} item
            WHERE item.id = {item_column}
              AND item.household_id = current_setting('app.current_household_id', true)
        )
        AND EXISTS (
            SELECT 1 FROM members member
            WHERE member.id = member_id
              AND member.household_id = current_setting('app.current_household_id', true)
        )
    """


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table, (item_column, item_table) in ASSOCIATIONS.items():
        policy = f"{table}_household_isolation"
        check = _household_check(item_column, item_table)
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")
        op.execute(f"""
            CREATE POLICY {policy} ON {table}
            AS PERMISSIVE
            FOR ALL
            USING ({check})
            WITH CHECK ({check})
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in ASSOCIATIONS:
        op.execute(f"DROP POLICY IF EXISTS {table}_household_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

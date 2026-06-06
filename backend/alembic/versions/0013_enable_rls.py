"""enable Row Level Security on all household-scoped tables

Defense-in-depth : même un attaquant avec DATABASE_URL ne peut rien lire
sans avoir mis `app.current_household_id` à un foyer valide. Le middleware
FastAPI fait ce SET LOCAL avant chaque requête authentifiée.

Important — sur Supabase, le rôle `postgres` a BYPASSRLS=true par défaut.
Cette migration crée les policies mais elles ne sont actives qu'avec un
rôle NOBYPASSRLS. Voir docs/RLS_ACTIVATION.md pour la procédure complète.

Revision ID: 0013_enable_rls
Revises: 0012_documents
"""
from alembic import op
import sqlalchemy as sa


revision = '0013_enable_rls'
down_revision = '0012_documents'
branch_labels = None
depends_on = None


# 20 tables avec `household_id` à protéger.
# Exclus du RLS (raisons documentées):
#   - users                  : login cross-household par design
#   - households             : la table parente elle-même
#   - auth_events            : audit log système, monitoring admin
#   - password_reset_tokens  : flow reset par email, cross-household
HOUSEHOLD_TABLES = [
    'members',
    'accounts',
    'transactions',
    'assets',
    'liabilities',
    'categories',
    'categorisation_rules',
    'payees',
    'payee_match_rules',
    'budgets',
    'goals',
    'bank_connections',
    'achievements',
    'wealth_snapshots',
    'fixed_charges',
    'dca_plans',
    'ref_months',
    'planned_events',
    'documents',
]
# Note: la table `ref_months` a `member_id` nullable + `household_id` ; on
# isole uniquement par household — l'app filtre par member ensuite.


def upgrade():
    # SQLite (tests) ne supporte pas RLS — on no-op proprement.
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    for table in HOUSEHOLD_TABLES:
        # 1) Activer RLS sur la table. Sans policy, RLS = "deny all".
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # 2) Forcer RLS aussi pour le propriétaire de la table (sinon le owner
        #    voit tout). Sans ça, le rôle qui possède les tables bypasse.
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        # 3) Policy d'isolation : ne voir que les lignes dont household_id
        #    correspond à la variable de session app.current_household_id.
        #    `RESTRICTIVE` + `FOR ALL` = s'applique à SELECT/INSERT/UPDATE/DELETE.
        #    `current_setting(..., true)` retourne NULL si non set → 0 ligne
        #    (donc requête non authentifiée = aucun accès, c'est voulu).
        policy_name = f"{table}_household_isolation"
        op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")
        op.execute(f"""
            CREATE POLICY {policy_name} ON {table}
            AS RESTRICTIVE
            FOR ALL
            USING (household_id = current_setting('app.current_household_id', true))
            WITH CHECK (household_id = current_setting('app.current_household_id', true))
        """)


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    for table in HOUSEHOLD_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_household_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

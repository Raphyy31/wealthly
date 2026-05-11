"""enable_banking — refonte du schéma bank_connections

Le pivot GoCardless → Enable Banking (commit 0441287) a remplacé le
modèle SQLAlchemy `BankConnection` mais sans migrer la table en DB.
La table existante (créée par create_all() au baseline 0001) avait
le schéma GoCardless :
  - requisition_id, agreement_id, reference, status, last_sync_at,
    last_sync_error, expires_at, provider, institution_id,
    institution_name, institution_logo

Le nouveau modèle Enable Banking attend :
  - session_id, bank_name, bank_country, status, state,
    accounts_data, error_message, last_synced_at

→ Drop + recreate de la table + drop de bank_account_links (orpheline).
Données existantes perdues — acceptable car en prod il n'y a pas eu
de connexion GoCardless réussie (l'utilisateur a pivoté avant).

Defensive : guards IF EXISTS / IF NOT EXISTS pour idempotence.

Revision ID: 0005_enable_banking_schema
Revises: 0004_household_plan
Create Date: 2026-05-11
"""
from typing import Sequence, Union

from alembic import op


revision: str = '0005_enable_banking_schema'
down_revision: Union[str, None] = '0004_household_plan'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the old GoCardless companion table (orpheline depuis le pivot).
    op.execute("DROP TABLE IF EXISTS bank_account_links CASCADE")

    # 2. Drop + recreate bank_connections avec le schéma Enable Banking.
    #    DROP CASCADE pour gérer d'éventuels FKs résiduels.
    op.execute("DROP TABLE IF EXISTS bank_connections CASCADE")

    op.execute("""
        CREATE TABLE bank_connections (
            id               VARCHAR PRIMARY KEY,
            household_id     VARCHAR NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            session_id       VARCHAR,
            bank_name        VARCHAR NOT NULL,
            bank_country     VARCHAR DEFAULT 'FR',
            status           VARCHAR DEFAULT 'pending',
            state            VARCHAR,
            accounts_data    JSONB,
            error_message    TEXT,
            last_synced_at   TIMESTAMP WITHOUT TIME ZONE,
            created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_bank_connections_household_id ON bank_connections (household_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bank_connections_state        ON bank_connections (state)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bank_connections_session_id   ON bank_connections (session_id)")


def downgrade() -> None:
    # Pas de rollback automatique vers le schéma GoCardless — le code l'a
    # supprimé. Si jamais besoin de revenir, restaurer le modèle d'abord.
    op.execute("DROP TABLE IF EXISTS bank_connections CASCADE")

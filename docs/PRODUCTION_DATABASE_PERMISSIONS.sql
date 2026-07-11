-- Réparation des droits du rôle applicatif Wealthly.
-- À exécuter dans Supabase > SQL Editor avec le rôle propriétaire (postgres).
-- Idempotent : ce script peut être rejoué sans modifier les données.

BEGIN;

GRANT USAGE ON SCHEMA public TO wealthly_app;

-- Répare toutes les tables déjà présentes. Cela inclut account_members,
-- dont INSERT/DELETE sont nécessaires pour changer le titulaire d'un compte.
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO wealthly_app;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO wealthly_app;

-- Les tables de liaison n'ont pas de colonne household_id. Leur foyer est
-- déduit du compte/actif/passif ET du membre liés. RLS était activé en prod
-- sans policy INSERT utilisable, ce qui bloquait le changement de titulaire
-- et la création de comptes pendant une synchronisation GoCardless.
DO $$
DECLARE
    policy_row record;
BEGIN
    FOR policy_row IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('account_members', 'asset_members', 'liability_members')
    LOOP
        EXECUTE format(
            'DROP POLICY %I ON %I.%I',
            policy_row.policyname,
            policy_row.schemaname,
            policy_row.tablename
        );
    END LOOP;
END $$;

ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members FORCE ROW LEVEL SECURITY;
CREATE POLICY account_members_household_isolation ON account_members
AS PERMISSIVE FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = account_members.account_id
          AND accounts.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = account_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = account_members.account_id
          AND accounts.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = account_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
);

ALTER TABLE asset_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_members FORCE ROW LEVEL SECURITY;
CREATE POLICY asset_members_household_isolation ON asset_members
AS PERMISSIVE FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM assets
        WHERE assets.id = asset_members.asset_id
          AND assets.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = asset_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM assets
        WHERE assets.id = asset_members.asset_id
          AND assets.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = asset_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
);

ALTER TABLE liability_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_members FORCE ROW LEVEL SECURITY;
CREATE POLICY liability_members_household_isolation ON liability_members
AS PERMISSIVE FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM liabilities
        WHERE liabilities.id = liability_members.liability_id
          AND liabilities.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = liability_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM liabilities
        WHERE liabilities.id = liability_members.liability_id
          AND liabilities.household_id = current_setting('app.current_household_id', true)
    )
    AND EXISTS (
        SELECT 1 FROM members
        WHERE members.id = liability_members.member_id
          AND members.household_id = current_setting('app.current_household_id', true)
    )
);

-- Les tables créées ensuite par le rôle postgres recevront les mêmes droits.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wealthly_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO wealthly_app;

-- La réparation ci-dessus correspond à la migration livrée avec le hotfix.
-- Évite qu'Alembic tente de la rejouer avec le rôle applicatif non-propriétaire.
UPDATE alembic_version
SET version_num = '0016_association_rls'
WHERE version_num = '0015_ai_state';

COMMIT;

-- Résultat attendu : les quatre colonnes valent true pour account_members.
SELECT
    has_table_privilege('wealthly_app', 'public.account_members', 'SELECT') AS can_select,
    has_table_privilege('wealthly_app', 'public.account_members', 'INSERT') AS can_insert,
    has_table_privilege('wealthly_app', 'public.account_members', 'UPDATE') AS can_update,
    has_table_privilege('wealthly_app', 'public.account_members', 'DELETE') AS can_delete;

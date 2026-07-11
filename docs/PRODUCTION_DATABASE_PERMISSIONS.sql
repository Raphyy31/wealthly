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

-- Les tables créées ensuite par le rôle postgres recevront les mêmes droits.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wealthly_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO wealthly_app;

COMMIT;

-- Résultat attendu : les quatre colonnes valent true pour account_members.
SELECT
    has_table_privilege('wealthly_app', 'public.account_members', 'SELECT') AS can_select,
    has_table_privilege('wealthly_app', 'public.account_members', 'INSERT') AS can_insert,
    has_table_privilege('wealthly_app', 'public.account_members', 'UPDATE') AS can_update,
    has_table_privilege('wealthly_app', 'public.account_members', 'DELETE') AS can_delete;

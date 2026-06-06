# Activation de Row Level Security — étapes manuelles Supabase

Le code est prêt (migration `0013_enable_rls` + middleware dans
`get_current_user`). Il **ne protège réellement** qu'une fois cette
procédure exécutée. Sans elle, les policies RLS existent mais sont
**ignorées** par le rôle `postgres` (qui a `BYPASSRLS=true` par défaut).

⏱️ Temps estimé : **10 minutes**. À faire en une fois — pas de demi-état.

---

## TL;DR

1. Créer un rôle Postgres `wealthly_app` avec `NOBYPASSRLS` sur Supabase.
2. Lui donner les privilèges sur le schéma + tables.
3. Mettre à jour `DATABASE_URL` sur Railway pour utiliser ce rôle.
4. Railway redéploie automatiquement. Vérifier en prod.

---

## Étape 1 — Créer le rôle `wealthly_app` sur Supabase

**Supabase Dashboard → SQL Editor → New query**, coller et exécuter :

```sql
-- Crée un rôle applicatif avec mot de passe et sans BYPASSRLS.
-- Remplace 'CHANGEME_MOT_DE_PASSE_FORT' par un mot de passe long aléatoire
-- (24+ caractères, à conserver dans un gestionnaire de mots de passe).
CREATE ROLE wealthly_app WITH
  LOGIN
  PASSWORD 'CHANGEME_MOT_DE_PASSE_FORT'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOBYPASSRLS;

-- Donne au nouveau rôle l'accès au schéma public + connect.
GRANT CONNECT ON DATABASE postgres TO wealthly_app;
GRANT USAGE ON SCHEMA public TO wealthly_app;

-- Privilèges DML sur TOUTES les tables existantes + futures.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wealthly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wealthly_app;

-- S'applique aussi aux tables/séquences créées plus tard par les migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wealthly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wealthly_app;
```

✅ **Vérification** : exécute ensuite ceci pour confirmer que `bypassrls = false` :

```sql
SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'wealthly_app';
-- Attendu : wealthly_app | f | f
```

---

## Étape 2 — Construire la nouvelle `DATABASE_URL`

Sur Supabase Dashboard → **Project Settings → Database → Connection string** :

- Copie l'URL "Session pooler" (port 5432 typiquement) ou "Transaction pooler" (6543).
- Tu obtiens un format du genre :
  `postgresql://postgres.<ref>:<old-password>@aws-...pooler.supabase.com:5432/postgres`
- **Remplace** `postgres.<ref>` par `wealthly_app` et le mot de passe par celui choisi à l'étape 1 :
  `postgresql://wealthly_app:<NEW_PASSWORD>@aws-...pooler.supabase.com:5432/postgres`

⚠️ **Garde l'ancienne URL** quelque part (gestionnaire de mots de passe) — utile en cas de rollback.

---

## Étape 3 — Mettre à jour Railway

**Railway Dashboard → Wealthly Backend → Variables** :
- Édite `DATABASE_URL` → colle la nouvelle valeur (étape 2).
- Sauvegarde. Railway redéploie automatiquement (~1 min).

---

## Étape 4 — Vérifier que c'est actif

### A. Le backend boot proprement

```bash
curl -i https://wealthly-production-45aa.up.railway.app/health
# → 200 OK
```

### B. L'app marche toujours (smoke test)

Ouvre https://wealthly-six.vercel.app, login, navigue. Tu dois voir tes
données normalement (le middleware `set_config` fait son job).

### C. Test d'isolation manuel (optionnel mais rassurant)

Dans Supabase SQL Editor, exécute en tant que `wealthly_app` :

```sql
-- Connection en tant que wealthly_app via le SQL Editor n'est pas directe ;
-- alternative : ouvre un SQL Editor avec un nouvel utilisateur OU teste
-- via psql en local avec la nouvelle DATABASE_URL.

-- Sans set_config, RLS bloque tout :
SET LOCAL ROLE wealthly_app;
SELECT COUNT(*) FROM accounts;
-- Attendu : 0 (la variable app.current_household_id est NULL)

-- Avec set_config sur un foyer existant, on voit ses comptes :
SELECT set_config('app.current_household_id', '<un_household_id_existant>', true);
SELECT COUNT(*) FROM accounts;
-- Attendu : N > 0
RESET ROLE;
```

---

## Rollback en cas de pépin

Si quelque chose casse en prod, **revenir à l'ancien `DATABASE_URL`** sur
Railway suffit (étape 3 inverse). Les policies RLS restent en place mais
sont à nouveau bypassées par le rôle `postgres` → état identique à avant.

Pour retirer complètement les policies :

```bash
# en local
alembic downgrade 0012_documents
```

---

## Annexe — Pourquoi on en arrive là

Sur Supabase, le rôle `postgres` qu'utilise notre `DATABASE_URL` actuelle
a `BYPASSRLS=true` (c'est documenté dans le Supabase guide RLS). Donc
même une fois les policies créées par la migration `0013_enable_rls`,
elles sont court-circuitées. Créer un rôle dédié `NOBYPASSRLS` est la
méthode standard recommandée par Supabase pour le code applicatif qui
veut bénéficier de RLS sans passer par PostgREST.

Cf. https://supabase.com/docs/guides/database/postgres/row-level-security

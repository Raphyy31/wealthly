# Wealthly — Roadmap cybersécurité

**Dernière mise à jour :** 2026-05-19 (audit complet expert cybersécurité)

Ce document liste l'état de la posture sécurité et les chantiers restants.
Il complète `CLAUDE.md` (contexte projet) et `docs/PLAN_2026-05-18.md`
(roadmap produit).

---

## 1. Posture actuelle — ce qui est en place

### Authentification
- ✅ bcrypt password hashing
- ✅ HIBP check à l'inscription (interdit mots de passe leaked)
- ✅ Politique mot de passe ≥10 chars + lettre + chiffre
- ✅ JWT signé HS256, durée 7 jours, stocké en cookie `HttpOnly, Secure`
- ✅ Brute-force lockout : 5 échecs login → blocage 30 min par (email, IP)
- ✅ Rate limiting slowapi sur auth (login 10/min, register 5/min, forgot 5/min)
- ✅ 2FA TOTP optionnel (pyotp + valid_window=1) — disponible Settings → Sécurité
- ✅ 2FA TOTP **obligatoire** (commit a posteriori 2026-05-19) — overlay forcé pour tout user sans 2FA
- ✅ Login step 2 (écran code TOTP post-password) — implémenté dans AuthScreen
- ✅ Auto-déconnexion après inactivité (30 min par défaut, paramétrable 15/30/60/Jamais)

### Headers HTTP
- ✅ HSTS (Strict-Transport-Security)
- ✅ Content-Security-Policy
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy
- ✅ Permissions-Policy
- ✅ CORS regex strict `^https://wealthly(-[a-z0-9-]+)?\.vercel\.app$`
- ✅ CORS methods/headers explicitement listés (pas de wildcard)

### Validation input
- ✅ Pydantic schemas : `max_length` sur tous les champs texte user
  (label 500, notes 2000, name 80-200, type 40, etc.)
- ✅ SQL injection : SQLAlchemy ORM partout, zéro `text()` avec concat user
- ✅ XSS : React JSX auto-escape, zéro `dangerouslySetInnerHTML` détecté
- ✅ Path traversal : aucun endpoint accepte de path user-controlled
- ✅ UUID4 (random) sur toutes les ressources — pas prédictible (IDOR safe)

### Rate limiting
- ✅ `/auth/login` 10/min
- ✅ `/auth/register` 5/min
- ✅ `/auth/forgot-password` 5/min
- ✅ `/auth/change-password` 5/hour
- ✅ `/auth/totp/setup` 5/hour
- ✅ `/auth/totp/verify` 10/hour
- ✅ `/auth/totp/disable` 5/hour
- ✅ `/transactions/import` 20/day
- ✅ `/categorize` 100/day

### Posture data
- ✅ Mode accès Postgres direct via SQLAlchemy + `DATABASE_URL`
  (pas de client Supabase JS frontend → pas de risque anon key leak)
- ✅ Filtre `household_id` systématique sur toutes les routes (lectures + mutations)
- ✅ Admin routes protégées par `Depends(require_admin)` (vérifie `is_admin == True`)
- ✅ Tests pytest cross-household isolation (DCA, catégorisation, snapshots)

### Audit & logging
- ✅ Table `AuthEvent` (kind, success, user_id, email, IP, UA, detail, ts)
- ✅ `record_auth_event` appelé sur register, login, logout, forgot, reset,
  change-password, totp_enabled, totp_disabled, totp_verify_failure,
  admin/users/{id}/toggle, admin/users/{id}/delete
- ✅ Stack traces des 500 loggées côté serveur (Railway logs)
- ✅ Endpoints 500 retournent message générique (pas de leak `str(exc)`)

### Secrets & config
- ✅ Aucun secret hardcodé dans le code
- ✅ `SECRET_KEY` et `DATABASE_URL` obligatoires en prod (refuse boot sans)
- ✅ `.env*` exclus du git
- ✅ Frontend `.env.production` contient uniquement `VITE_API_URL=/api`
  (pas de clés sensibles injectées au build)
- ✅ Cron `X-Cron-Secret` comparé en timing-safe via `hmac.compare_digest`
- ✅ Dedup hash bancaire en BLAKE2b (SHA-1 retiré, audit F2)

---

## 2. Chantiers restants — priorisés

### 🚨 P0 — Critique, à fixer rapidement

| ID | Titre | Effort | Statut |
|---|---|---|---|
| RLS-1 | **Row Level Security Postgres** sur toutes les tables — defense-in-depth si `DATABASE_URL` leakerait | L | ✅ **ACTIF en prod (2026-06-06)** — migration `0013_enable_rls` (ENABLE+FORCE RLS + policy RESTRICTIVE FOR ALL sur 20 tables) + middleware `set_config('app.current_household_id')` dans `get_current_user` + rôle Supabase `wealthly_app` (NOBYPASSRLS) sur `DATABASE_URL` Railway. Vérifié : 8 tables rls_active+rls_force=true, rôle bypassrls=false, app lit ses données. Procédure : `docs/RLS_ACTIVATION.md` |
| H4 | **Invalidation JWT après changement de mot de passe** (champ `password_version` sur User) | M | ⏳ À faire |
| H1 | **Validation X-Forwarded-For** contre liste de proxies Railway de confiance (sinon spoof IP bypass lockout) | S | ⏳ À faire |

### ⚠️ P1 — Haut, à planifier sur le prochain sprint sécurité

| ID | Titre | Effort | Statut |
|---|---|---|---|
| H2 | **CSRF token** double-submit sur mutations (SameSite=None laisse la porte ouverte) | M | ⏳ À discuter (alternative : forcer SameSite=Lax + proxy unifié frontend↔backend) |
| M1 | **Chiffrement TOTP secret** au repos en DB (HKDF depuis SECRET_KEY → Fernet/AES-GCM) | M | ⏳ À faire |
| M3 | **QR TOTP côté client** au lieu d'api.qrserver.com (évite la fuite du secret à un tiers) — libs `qrcode` ou `qrcode.react` | S | ⏳ À faire |
| M2 | **Pagination /admin/users** + journaliser les accès admin aux données sensibles + masquer IPs | M | ⏳ À faire |

### 🔧 P2 — Moyen/Faible, durcissement progressif

| ID | Titre | Effort | Statut |
|---|---|---|---|
| M5 | Politique mot de passe : exiger un caractère spécial OU passer à entropie minimale (zxcvbn) | XS | ⏳ |
| F1 | Migrer `datetime.utcnow()` → `datetime.now(timezone.utc)` partout (déprécié Python 3.12+) | S | ⏳ |
| F4 | Security headers dans `nginx.conf` (déploiement self-hosted Docker) | XS | ⏳ |
| INFO2 | À terme : proxy Vercel → Railway sous même domaine pour passer `SameSite=Lax/Strict` | L | ⏳ Architecture |
| INFO3 | Compléter `.env.example` avec `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` | XS | ⏳ |

---

## 3. Plan RLS Postgres — chantier dédié

C'est le seul défaut architectural majeur restant. Une fois implémenté, Wealthly aura une **defense-in-depth complète** : même un attaquant avec la `DATABASE_URL` ne pourra rien lire.

### Architecture cible

```sql
-- Pour chaque table avec scope household :
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_household_isolation ON accounts
  AS RESTRICTIVE FOR ALL
  USING (household_id = current_setting('app.current_household_id', true)::text);
```

```python
# Middleware FastAPI :
@app.middleware("http")
async def set_rls_context(request, call_next):
    user = await _try_get_user(request)
    if user:
        # Set la variable de session Postgres avant chaque requête
        with db_session() as db:
            db.execute(text("SET LOCAL app.current_household_id = :hid"),
                       {"hid": user.household_id})
    return await call_next(request)
```

### Étapes

1. **Migration Alembic `0008_enable_rls.py`** : `ENABLE RLS` + `CREATE POLICY` sur les ~17 tables (accounts, transactions, assets, liabilities, members, categories, custom_rules, payees, budgets, goals, achievements, wealth_snapshots, fixed_charges, dca_plans, ref_months, bank_connections, auth_events) — exclure `users` (cross-household par design pour le login)
2. **Middleware FastAPI** dans `main.py` qui SET LOCAL la var de session
3. **Vérifier le rôle applicatif Postgres** : ne pas être superuser ni `BYPASSRLS=TRUE`. Créer un rôle `wealthly_app` avec `NOBYPASSRLS` si nécessaire (Supabase a un rôle `authenticator` qui fait ça nativement)
4. **Tests pytest** :
   - Cross-household leak : créer 2 foyers, set la session var sur foyer A, vérifier que la requête sur les tables de foyer B retourne 0 lignes
   - Backward compat : tous les tests existants continuent de passer
5. **Documenter** : mode RLS dans CLAUDE.md (`things that bite`)

**Effort total : 1 session focalisée, ~1h30**

---

## 4. Plan 2FA obligatoire — état après cette session

| Composant | État |
|---|---|
| Backend `/auth/login` rejette avec 401 `totp_required` | ✅ Existait depuis commit 3298af1 |
| Backend `/auth/totp/setup`, `/verify`, `/disable` | ✅ Avec rate limit (commit 76d1291) |
| Frontend `AuthScreen` step 2 (écran code TOTP) | ✅ Implémenté 2026-05-19 |
| Frontend overlay **obligatoire** dans WealthlyApp si `totp_enabled === false` | ✅ Implémenté 2026-05-19 (composant `Mandatory2FAOverlay`) |
| Settings → Sécurité : toggle pour activer/désactiver | ✅ Existant — désactivation possible si déjà activé (relancera l'overlay au refresh) |
| Mode démo exempté | ✅ |
| Admin exempté | ❌ Volontairement non — les admins doivent aussi avoir 2FA |
| Grace period configurable (X jours avant enforcement) | ❌ Non implémenté — enforcement immédiat pour l'instant |

Pour les nouveaux utilisateurs : après `/auth/register`, le cookie est posé,
`me.totp_enabled === false`, l'overlay s'affiche → ils ne peuvent pas accéder
à l'app sans configurer la 2FA. ✓ Politique obligatoire effective.

---

## 5. Bonnes pratiques opérationnelles (à maintenir)

- **Rotation périodique** : changer `SECRET_KEY` tous les 12 mois (déconnecte tous les users — communiquer avant)
- **Audit des dépendances** : `npm audit` + `pip-audit` mensuel, traiter les CVE high/critical
- **Backup Supabase** : vérifier que les backups automatiques quotidiens sont activés (Supabase free tier les fait par défaut 7 jours)
- **Monitoring AuthEvent** : surveiller les patterns anormaux (pics de login_failure, ratio register vs login_success)
- **Tests de sécurité** : avant chaque déploiement majeur, relancer un audit ciblé

---

## Référence

- Audit initial : [commit 76d1291](https://github.com/Raphyy31/wealthly/commit/76d1291) (rate limiting + max_length)
- Audit Supabase : [commit 7b070d1](https://github.com/Raphyy31/wealthly/commit/7b070d1) (env vars hardening)
- Audit low-level expert : 2026-05-19 (ce document)
- Dépendances clés : FastAPI 0.115, SQLAlchemy 2.0.36, pyotp 2.9, bcrypt 4.0, slowapi 0.1.9

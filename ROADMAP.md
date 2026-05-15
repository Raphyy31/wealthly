# Wealthly — Roadmap

État au **2026-05-15** — catégories utilisateur + dual-select règles + Mois type modal.

---

## 🆕 Session 2026-05-15 — Raphyy31 + Claude (Opus 4.7)

6 commits push directs sur `main` (`1ec712f` … `0ef3513`). Voir `CLAUDE.md` pour le détail complet.

- [x] **Catégories utilisateurs** — créer / supprimer Catégorie (niveau 1) et Détail (niveau 2) depuis Réglages → Catégories & règles. Backend `POST/DELETE /categories` avec slugify + cascade rules/budgets/transactions. Modale de création avec picker icône + couleur + type.
- [x] **Toast + optimistic update** — feedback instantané sur create/delete (la liste ne dépendait plus du re-fetch, cold-start Railway invisible pour le user).
- [x] **Règles dual-select** — formulaire et modale `CreateRuleModal` repensés : choix Catégorie + Détail (optionnel). Liste affiche `Parent › Détail`.
- [x] **Filtre Transactions** — `❓ Non catégorisé` ajouté dans le picker rapide de la colonne Catégorie.
- [x] **Mois type modal** — drawer latéral 520px remplacé par modale centrée 1080px, layout 2 colonnes (Entrées + Épargne / Dépenses), inputs agrandis, totaux par section.
- [x] **Compte courant** — nouveau type `checking_account` (Wallet, cobalt) en tête d'ASSET_TYPES, agrégé sous Liquidités dans le donut Patrimoine.
- [x] **Fix 50/30/20** — `FiftyThirtyTwentyModal` lit maintenant `cat.kind` (au lieu d'un set hardcodé) pour bucketer le Mois type. Les user-cats avec `kind=needs/wants/savings` choisi à la création tombent enfin dans le bon bucket.

**Prochaine grosse session prévue (P0)** : **refonte du moteur de catégorisation** — Payees canoniques + Category Learning + 120 règles builtin inspirées d'Actual Budget. Prompt complet rédigé par l'utilisateur, à exécuter dans une session dédiée (multi-heures, backend + frontend + DB migration).

**Autres reste à faire** : 2FA TOTP, cron auto-sync GoCardless nightly + email re-consent J-7, i18n EN sur les composants 100% FR de cette session (`MyCategoriesSection`, `CreateRuleModal`, dual-select rules form).

---

## Session 2026-05-14 — Raphyy31 + Claude (Sonnet 4.6 → Opus 4.7)

Salve menée avec 4 puis 3 agents en parallèle dans des worktrees. Voir `CLAUDE.md` pour le détail.

**Livré (~12 commits push directs sur main)** :
- [x] **JWT migration finalisée** — legacy `localStorage` token retiré ; cookie httpOnly `trove_session` seul chemin. Bearer fallback conservé backend pour pytest.
- [x] **DCA point 1** — vraies valeurs marché via `useQuotes`, label "Valeur actuelle" / "Valeur théorique" selon dispo.
- [x] **DCA point 2** — suivi des versements réels (executions JSON + timeline 12 mois cliquable + indicator "N mois sautés" ocre + tests pytest cross-household).
- [x] **DCA point 3** — PlanCard migré au `.card` + `.card-header` canoniques.
- [x] **Dashboard insight Comparer mois** — catégorie courante vs moyenne 6m, seuils 30€/15%, fallback neutral si aucun delta significatif.
- [x] **i18n EN sweep** — ~180 clés (Dashboard, DCA, Settings, Wealth, AuthScreen, toasts/confirms WealthlyApp).
- [x] **Admin** — onglet Foyers + montants utilisateur retirés (table Patrimoine net, KPIs Foyers/Actifs suivis, ligne Foyer dans détail user).
- [x] **Wizard emprunt complet** — tous les champs liability capturés dès la création (capital initial/restant, mensualité, taux, durée, date début, bien rattaché, options avancées : apport, assurance, frais, quote-part). Fix `memberIds → member_ids` au passage.
- [x] **API version 2.1.0** — bump pour forcer un redéploy Railway figé (cause des 404 `/me/wipe` reportés).

**Pendant en fin de session** : un commentaire utilisateur sur "j'arrive pas à réinitialiser dans Zone dangereuse" a été résolu via le bump de version Railway. Le hard refresh est nécessaire côté client après chaque déploiement (PWA service worker).

---

## Session 2026-05-13 — Raphyy31 + Claude (Opus 4.7)

**Chantier 1 — Unification Account/Asset (18 tâches, brainstorm complet)**
- [x] Bug PEA invisible résolu (root cause : dualité Account vs Asset)
- [x] Migration DB `wealth_item_uuid` (préparation Option B) + `Asset.parent_asset_id`
- [x] Types canoniques `WealthItem` + hook `useWealthItems` (normalisation accounts+assets+liabilities)
- [x] API facade `api.wealth.*` (route create/update/delete vers la bonne table)
- [x] Vue Patrimoine v6 — 7 onglets alignés Finary (Tout · Liquidités · Comptes d'investissement · Immobilier · Cryptos · Autres · Emprunts)
- [x] Wizard "+ Ajouter" unifié 3 étapes (catégorie → sous-catégorie + mode → form / bank flow)
- [x] Drawer détail unifié 880px — § 01 Positions · § 03 Insight fiscal · § 04 Configuration
- [x] Détection doublons stricte (boolean, member-aware) + banner + modal de fusion
- [x] Mapping legacy `investment`/`joint`/`professional` → bons subtypes (fix PEA → Liquidités)
- [x] Suppression du bouton "+ Ajouter" doublon dans le card-header (canonique = subview-header)
- [x] Tests pytest backend (wealth_item_uuid nullable)
- [x] Spec + plan complets dans `docs/superpowers/{specs,plans}/2026-05-13-*`

**Chantier 2 — Polish vue Emprunt (Finary-style)**
- [x] AreaChart lisse (vs BarChart en escaliers)
- [x] Panneau Mensualité Newsreader italic + breakdown Capital/Intérêts/Assurance (dots colorés)
- [x] Stats échéances payées/restantes/date de fin
- [x] Phrase humaine "Vous avez remboursé X % du capital"
- [x] 3 cards Synthèse horizontales (Coût total / Total remboursé / Capital restant dû)

**Chantier 3 — Refonte Settings UX (Monarch-style)**
- [x] Nav latérale sticky 240px + 7 sections (Profil · Foyer · Comptes & sync · Sécurité · Catégories & règles · Devises & langue · Données)
- [x] URL hash sync (`#settings/securite`)
- [x] Section Profil : base currency + langue surfacés (étaient dead props !)
- [x] Section Sécurité : placeholder 2FA + activity feed (degrade gracieusement si pas admin)
- [x] Section Données : Danger Zone séparée pour Reset (bordure terracotta)
- [x] Mobile (<900px) : nav latérale → strip horizontal scrollable

**Chantier 4 — Import CSV positions Boursorama**
- [x] `Asset.parent_asset_id` (migration + ORM + schema + router)
- [x] Parser CSV Boursorama (semicolon + virgule décimale + BOM-safe + noms quotés)
- [x] `ImportPositionsModal` (upload → preview → done)
- [x] Hook `useWealthItems` agrège enfants en `positions[]` du parent (auto-grouping)
- [x] Drawer affiche table positions inline après import

---

## ✅ Livré

### Rebrand & landing (Raphyy31 — 2026-05-09/10)
- [x] **Rebrand Wealthly → Trove** (logo, nom, manifest, HTML title, AuthScreen)
- [x] **Landing page v2** — sections Fonctionnement / Fonctionnalités / Sécurité / Tarifs (3 plans) / FAQ / CTA final
- [x] **Page Tarifs** : Solo 0€ / Pro 7,99€/mois / Famille 14,99€/mois — toggle Mensuel/Annuel (−20 %)
- [x] **Sidebar app** restructurée en 3 groupes : VUE D'ENSEMBLE / GESTION / CONFIGURATION
- [x] **Dashboard v2** : hero "Bonsoir" + courbe interactive + Insights + Objectifs + cards comptes
- [x] **demoData.js** réécrit (comptes à soldes réalistes, transactions Paris cadre, LCL compte joint positif)

### Sécurité backend (Raphyy31 — 2026-05-10)
- [x] **`security.py`** — audit log (`record_auth_event`), brute-force lockout (5 échecs/15 min → blocage 30 min), HIBP k-anonymity password check, CSP + HSTS + X-Frame-Options + headers complets
- [x] **`AuthEvent` table** — journal de connexions (IP, UA, kind, success, created_at)
- [x] **`User.is_admin`** et **`User.full_name`** — champs admin et nom complet
- [x] **`/admin` router backend** — `GET /admin/stats`, `GET /admin/auth-events`, `GET /admin/users` (protégé par `require_admin`)
- [x] **`Admin.jsx` frontend** — KPIs sécurité, table événements, table users (visible seulement si `is_admin`)
- [x] **Multi-currency hooks** (`useBaseCurrency`, `useQuotes`, `useRates`) + service quotes Frankfurter/Yahoo

### Sécurité précédente (2026-05-06)
- [x] Rate limiting auth (slowapi) : login 10/min, register 5/min, forgot-password 5/min
- [x] CORS regex pour tous les deploys Vercel
- [x] JWT signé 7 jours, bcrypt passwords, SHA-256 reset tokens
- [x] Alembic infrastructure (auto-stamp baseline)
- [x] 25+ tests pytest (auth, reset, snapshots, rules, banks) + CI GitHub Actions

### Fonctionnalités core (sessions précédentes)
- [x] Gestion multi-membres foyer (adultes + enfants), comptes bancaires avec rôles cashflow
- [x] Import CSV (détection auto banque), synchro PSD2 GoCardless (90j consent, dedup external_id)
- [x] Transactions : filtres multi-critères, catégorisation regex + IA Claude Haiku (BYOK), virements internes (auto-detect + override manuel)
- [x] Patrimoine : actifs/passifs, snapshots mensuels, plus-values latentes, plafonds PEA/Livret A
- [x] Score santé 0-100 (jauge SVG, 5 critères), Cashflow Sankey, 50/30/20 budgets, objectifs épargne
- [x] Simulateur IR 2025 FR (barème, parts, crédits, niches 10 000 €)
- [x] PDF bilan dark multi-pages, PWA installable, i18n FR/EN (partiel)
- [x] Mot de passe oublié (Resend, 60 min, single-use)

---

## 🐛 Bugs connus

> ⚠️ Section partiellement stale — les bugs ci-dessous datent de la démo 2026-05-10 (avant rollback Trove → Wealthly). Validation en cours sur Vercel après push du 2026-05-13. À retrier prochaine session.

### Demo data — incohérences critiques

| # | Problème | Fichier | Fix |
|---|----------|---------|-----|
| 1 | **Double logement** : "Virement loyer 14 rue de Vaugirard" −1 400 €/mois + "Échéance prêt immobilier" −1 150 €/mois. Un propriétaire ne paie pas de loyer. Double comptage housing = 2 550 €/mois. | `frontend/src/demoData.js` | Remplacer "Virement loyer" par "Charges de copropriété" −250 €/mois |
| 2 | **YTD +1257 %** sur le hero — absurde. Probablement aucun `wealthSnapshots` dans `getDemoData()` → calcul compare à 0. | `frontend/src/demoData.js` + Dashboard | Ajouter des snapshots réalistes dans le seed (6 mois, +3–5 %/an) |
| 3 | **Widget "Activité récente"** : libellés "—" et "Non catégorisé" sur le Dashboard, alors que /transactions affiche tout correctement. Régression post-refonte. | `frontend/src/views/Dashboard.jsx` | Vérifier le mapping `label` / `categoryId` dans le composant |
| 4 | **Donut "NET" faux** : affiche ~515 000 € (somme brute actifs) au lieu du patrimoine net ~284 000 €. | `frontend/src/views/Dashboard.jsx` | Corriger le calcul ou changer le label en "ACTIFS BRUTS" |

### Budget mensuel réaliste — persona cible

**Couple Paris : Alice 3 850 €/mois + Bob 3 220 €/mois, propriétaires, 1 enfant (Léa)**

```
REVENUS                         7 070 €
Prêt immobilier (seul item)    −1 150 €
Charges copropriété              −250 €  ← remplace le loyer erroné
Crèche Léa                       −680 €
EDF + Free Box                   −127 €
Assurances (habitation + auto)    −96 €
CESU Mme Sanchez                 −160 €
Abonnements (Netflix+Spotify+sport)  −68 €
Carburant                        −140 €
Courses (Carrefour+Monoprix+Naturalia)  −348 €
Restaurants + loisirs            −116 €
Épargne Livret A                 −600 €
─────────────────────────────────────
RESTE À VIVRE                  3 335 €  (47 % d'épargne — excellent, crédible)
```

---

## 🔜 À faire — priorisé

### 🔴 P0 — Migration Alembic (bloquant pour prod)

Les nouvelles tables/colonnes (`AuthEvent`, `User.is_admin`, `User.full_name`) existent via `create_all()` mais **aucune revision Alembic n'existe**. Sur une DB existante, ces colonnes sont absentes → admin panel cassé en prod.

- [ ] `alembic revision --autogenerate -m "add_auth_events_admin_fields"` et vérifier le diff
- [ ] Ajouter `User.is_active` si absent (nécessaire pour suspension utilisateur)
- [ ] Tester la revision sur la DB Supabase Railway avant de pousser

### 🔴 P0 — Créer les 2 comptes admin

Aucun moyen de créer un admin sans accès DB direct. Besoin d'un script :

- [ ] `backend/scripts/seed_admins.py` — crée/met à jour les comptes kdtheory + Raphyy31 avec `is_admin=True`
- [ ] Variables d'env : `ADMIN_EMAIL_1`, `ADMIN_PASSWORD_1`, `ADMIN_EMAIL_2`, `ADMIN_PASSWORD_2`
- [ ] Lancer via `railway run python backend/scripts/seed_admins.py` (one-shot)

### 🔴 P0 — Corriger les 4 bugs démo (tableau ci-dessus)

### ✅ P1 — JWT → httpOnly cookies (livré 2026-05-14)

Backend : cookie `trove_session` httpOnly/Secure/SameSite=None depuis 2026-05-10, finalisé 2026-05-14 par la suppression du legacy `localStorage` token frontend (`LEGACY_TOKEN_KEY`, `getToken/setToken/clearToken`, header Bearer côté navigateur). Bearer fallback conservé backend uniquement pour pytest. CORS `allow_credentials=True` déjà en place.

### 🟠 P1 — 2FA TOTP (obligatoire pour admins)

- [ ] Table `totp_secrets` (user_id, secret, backup_codes JSON, verified_at)
- [ ] `POST /auth/totp/setup` → génère secret PyOTP + URI QR
- [ ] `POST /auth/totp/verify` → active le TOTP
- [ ] `POST /auth/totp/disable` → désactive (admin seulement)
- [ ] Flow login modifié : si TOTP actif → retourner `{ requires_totp: true, partial_token }` → frontend step 2
- [ ] Middleware admin : bloquer `/admin/*` si TOTP non vérifié pour les `is_admin`
- [ ] Frontend `AuthScreen.jsx` : écran "Entrez votre code 2FA" (6 chiffres + backup code)
- [ ] `Settings.jsx` : section "Sécurité du compte" — activer/désactiver TOTP + afficher backup codes

### 🟡 P2 — Admin panel — actions manquantes

Panel actuel = lecture seule. À ajouter :

- [ ] `PUT /admin/users/{id}/toggle-active` — suspendre/réactiver (toggle `is_active`) + audit log
- [ ] `DELETE /admin/users/{id}` — suppression avec confirmation (soft delete recommandé)
- [ ] Frontend : boutons Suspendre / Réactiver / Supprimer dans la table users
- [ ] Pagination sur `/admin/auth-events` (actuellement limité à 100)

### 🟡 P2 — Cron bank sync + alertes DSP2

- [ ] `POST /internal/sync-all-banks` protégé par header `X-Cron-Secret`
- [ ] Cron Railway planifié 1×/jour à 6h UTC
- [ ] Email Resend J-7 avant expiration consentement (90 jours)

### 🔵 P3 — Docker self-hosting production-grade

- [ ] Audit `docker-compose.yml` actuel (volumes, restart policies, healthchecks)
- [ ] `docker-compose.prod.yml` avec Caddy (TLS auto) + Postgres local + backend + frontend
- [ ] Images publiées sur GHCR
- [ ] `SELF_HOSTING.md` : guide install, backup, mise à jour, variables d'env

### ⚪ Plus tard

- [ ] **Multi-devise complet** : brancher les hooks `useQuotes`/`useRates`/`useBaseCurrency` (déjà créés) sur le frontend
- [ ] **Tests frontend vitest** : moteur fiscal `taxFr.js`
- [ ] **Stripe paywall** : Solo 0€ / Pro 7,99€ / Famille 14,99€ — landing prête, backend à faire
- [ ] **Vérification trademark "Trove"** (EUIPO/INPI/USPTO) + achat domaine
- [ ] **Architecture multi-pays** : champ `country` sur households, gating composants FR-only
- [ ] **TypeScript** : migration progressive si friction concrète

---

## 🎨 Design — Raphyy31 (cette semaine)

- [ ] Revue complète avec Claude Design (direction visuelle landing + app)
- [ ] Mettre à jour les mockups dans la landing (affichent encore "Wealthly")
- [ ] Remettre le toggle i18n FR/EN visible dans l'UI
- [ ] Cohérence design entre landing (gradient violet/bleu) et app intérieure

---

## 🚫 Hors scope

- ❌ Rebalancing automatique d'allocation
- ❌ Garde alternée dans le simulateur d'impôt
- ❌ Mode clair (dark-only)
- ❌ Agent IA réseaux sociaux (réservé post-commercialisation)

---

## 📅 Sessions

**2026-05-10 — Analyse live + planification sécurité (kdtheory + Claude)**
Navigation directe sur la démo Trove. Bugs identifiés : double loyer demoData (propriétaire + loyer = impossible), YTD +1257 % absurde, widget Activité récente cassé (libellés "—"), donut label "NET" faux (515 k vs 284 k). Analyse persona réaliste : couple Paris 7 070 €/mois + enfant. Pull repo → découverte push massif Raphyy31 : security.py (audit log, lockout, HIBP, CSP), admin.py + Admin.jsx (panel lecture seule), multi-currency hooks. TODO réorganisée P0/P1/P2/P3.

**2026-05-08/09 — Refonte Trove (Raphyy31)**
Rebrand Wealthly → Trove. Landing v2 (tarifs 3 plans, FAQ, sécurité, fonctionnement). Dashboard v2 (hero, courbe interactive, Insights, Objectifs). Sidebar restructurée. demoData.js réécrit. security.py + admin.py + Admin.jsx livrés. Hooks multi-devise.

**2026-05-08 — Account roles + transfer detection (kdtheory)**
5 rôles cashflow/compte, détection virements internes auto (±3j, ±1 %), override manuel tri-state, section Mouvements internes Dashboard.

**2026-05-06 — Investor-ready push (Raphyy31 + kdtheory)**
Refonte visuelle Méridien, découpe WealthlyApp.jsx −82 %, rate limiting, Alembic, filtres transactions, score santé SVG, plus-values latentes, plafonds régulés, PDF dark, i18n FR/EN.

**2026-05-05 — Session fondatrice**
Stack, import CSV, PWA, simulateur IR, DSP2, budgets, snapshots, reset password, mode démo.

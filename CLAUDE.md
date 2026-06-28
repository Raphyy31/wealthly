# CLAUDE.md — context for AI assistants

Notes for Claude (and any future AI tooling) picking the project back up.
**Read this first** before making non-trivial changes.

> 📋 **Plans actifs** :
> - `docs/PLAN_2026-05-18.md` — roadmap produit (22 chantiers / 6 phases)
> - `docs/SECURITY_ROADMAP.md` — état sécurité + chantiers restants (RLS, CSRF, etc.)

---

## Session 2026-06-28 — Raphyy31 + Claude (Sonnet 4.6 → Opus 4.7) — charte Forêt + landing immersive + fix login 500

**Tout sur `main` + `claude/wealthly-project-u3527b`, déployé.** Bascule charte « Forêt », tentative Google OAuth abandonnée (cause du 500 login), refonte landing/film, sidebar icon-rail.

### 🎨 Charte « Forêt » (remplace papier-chaud + cobalt)
- Accent passe de **cobalt `#2540D9`** → **émeraude `#0E7C56`** (light) / **`#41D49B`** (dark)
- Tokens `index.css` `@theme` block ET `:root` mis à jour — l'oubli du `@theme` faisait que les utilities Tailwind compilaient encore en cobalt
- Logo refait : carré émeraude `#41D49B` + carré sombre `#0C1009` intérieur (proportions calées sur le SVG du film). **Plus de monogramme W.** Identité stable en clair comme en sombre (pas de flip de couleur selon le thème — seul le wordmark suit). `frontend/src/components/Logo.jsx` + `icon.svg` + `icon-maskable.svg` alignés. `index.html` favicon bumpé `?v=4`.
- Fallbacks neutres Forêt : `#ECF1E9` (bg crème), `#10150F` (ink), `#F7F9F6` (bg light)

### 🛬 Landing — hero immersif (style Linear/Vercel/Apple)
`frontend/src/views/landing/FilmHero.jsx` refondu plusieurs fois jusqu'au layout final :
- **Split desktop** (texte gauche + film droite, visible immédiatement dès l'arrivée — pas de scroll requis)
- Fond `#0a0e08` avec halo radial émeraude + grid subtile
- Eyebrow en chip Forêt, titre Geist 62px avec « *en un seul regard.* » en italique Newsreader émeraude
- Le sélecteur global `:root h1 em` (`index.css` ligne 4605) FORCE `font-style: normal; color: var(--ink)` → il fallait un sélecteur plus spécifique `.film-hero h1.fh-title .fh-title-accent` pour battre la cascade et garder l'italique émeraude
- CTAs : primary émeraude avec halo + ghost glassmorphism (rgba+blur)
- Film en iframe avec **mask gradient horizontal** (les bords G/D fondent dans le noir, contenu central net), `border-radius: 22px`, `height: 124%` + `overflow:hidden` → la barre de lecture du film embarqué (play/scrubber/download) sort du cadre visible. `pointer-events: none` sur l'iframe.
- Stack mobile en colonne (breakpoint 960px)
- ⚠️ Stages intermédiaires testés et abandonnés : full-bleed avec texte par-dessus (overlap moche), mask radial (floutait le centre), card avec border (encadré crème sur fond sombre — pas intégré)

### 🎬 Film landing (CSP)
Le film bundle (`/public/film-16x9.html` 261 Ko, `/public/film-9x16.html` 259 Ko, autonomes) charge React/ReactDOM depuis `https://unpkg.com` au runtime. Le CSP `vercel.json` sur `/film-*.html` les bloquait → `[dc] failed to load React or boot`. **Fix** : ajout `https://unpkg.com` à `script-src` et `connect-src` dans la règle CSP scopée aux pages film. La CSP de l'app principale reste stricte (aucun CDN externe).

### 🪟 Sidebar icon-rail collapsible
`index.css` ~ligne 998 : sidebar passe à **64px** par défaut → **240px** au hover. Tentative initiale avec `opacity: 0` cachait les éléments mais GARDAIT leur hauteur → les 4 pills membres (AG/AM…) s'empilaient en blocs colorés, le footer (cloche/thème/langue/devise/démo) wrappait n'importe comment, les labels de groupe faisaient des trous. **Fix** : `display: none` au lieu de `opacity: 0`. En collapsed, seuls subsistent **logo + icônes nav + avatars comptes + avatar user**. Tout le texte/badges/footer apparaît au hover via `display: ...` restauré.

### 🔴 Login 500 — Google OAuth retiré complètement
**Symptôme** : `/api/auth/login` → 500 systématique depuis l'ajout de Google sign-in (commit `ee94277`). Login marchait avant. **Causes successives** :
1. **Syntax error Python** (`48b70ea`) : f-string `f"Foyer de {name.split()[0] if name else 'l\\'utilisateur'}"` — backslash dans une expression f-string interdit en Python ≤ 3.11. L'`import` du module `auth.py` plantait → TOUS les endpoints `/auth/*` en 500.
2. **Colonne manquante** (suspect mais non confirmé) : `User.google_id` ajoutée au modèle ORM. Si la migration `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id` foirait silencieusement au boot, `db.query(User)` générait `SELECT users.google_id` → 500 « column does not exist ».

**Décision user** : « *enleve toute relation avec google, ca marchait avant* ». **Rip complet** (commit `2400bf8`) :
- Backend : retire `User.google_id`, `/auth/config`, `/auth/google`, schemas `GoogleSignInRequest`/`AuthConfigOut`, migration google_id (lightweight + bootstrap), import dans router
- Frontend : retire boutons Google dans `AuthModal.jsx` + `AuthScreen.jsx`, helpers `auth.getConfig`/`auth.googleSignIn` dans `api.js`, GSI script dans `index.html`
- `vercel.json` : nettoie CSP (plus de `accounts.google.com` / `oauth2.googleapis.com`)
- `GOOGLE_CLIENT_ID` reste dans `config.py` mais inutilisé — zéro impact

**Leçon** : ne jamais ajouter une colonne à un modèle ORM en prod sans s'assurer ABSOLUMENT que la migration s'applique (et qu'on voit le succès/échec dans les logs). Le pattern « lightweight migrations IF NOT EXISTS » est silencieusement fragile si la liste de statements crash en milieu de course.

### 🔧 Autres correctifs
- **Sidebar** : commit `9d18b43` avait ajouté l'icon-rail + bootstrap `ADMIN_EMAILS` (`config.py` + `main.py`). Ce dernier reste utile : poser `ADMIN_EMAILS=raphael.darmon1@gmail.com` sur Railway → promotion idempotente au boot.
- **AuthModal popup** (`AuthModal.jsx` ~600 lignes) : reste en place pour ouvrir l'auth depuis la landing sans changer de page. `App.jsx` route :
  - URL `?reset_token=…` → `AuthScreen` plein écran (mode reset)
  - Sinon → Landing + `AuthModal` (créé via `createPortal(jsx, document.body)`)

### Restant / actions Railway requises
- Poser `ADMIN_EMAILS=raphael.darmon1@gmail.com` sur Railway (pas encore fait → admin 403)
- Connexions GoCardless expirées (90 j DSP2) → reconnecter dans Réglages → Comptes bancaires
- Le commit `c580349` puis `2400bf8` ont reverté les ajouts CSP Google — la CSP principale est à nouveau strict (aucun CDN externe sauf fonts Google)

---

## Session 2026-06-08 — Raphyy31 + Claude (Opus 4.8) — correctifs prod critiques + bilan PDF + export Excel

**Tout sur `main`, déployé.** Série de fixes prod (signalés par l'user en live) + finition bilan PDF + export Excel.

### 🔴 Correctifs critiques prod
- **Inscription cassée (500)** : la table `households` en prod n'avait pas la colonne `plan` (dérive de schéma — l'ORM la déclare mais `create_all` n'ajoute pas les colonnes manquantes). `INSERT INTO households` plantait. **Fix** : `ALTER TABLE households ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'solo' NOT NULL` ajouté aux migrations légères de démarrage (`main.py:_run_lightweight_migrations`). Vérifié prod → register 201. ⚠️ **Diag** : le handler global `@app.exception_handler(Exception)` (main.py) masque le détail des 500 → pour diagnostiquer, lever temporairement une `HTTPException(422, detail=...)` (non masquée) plutôt que lire les logs.
- **Inscription + RLS** : `register` insère les `DEFAULT_CATEGORIES` (table `categories` en FORCE RLS) alors qu'aucun user n'est encore authentifié → `set_config('app.current_household_id', household.id, true)` posé juste après le flush du foyer, avant l'insert des catégories.
- **Onboarding bloquant** : `completeOnboarding` faisait `reloadAll()` (15 endpoints en //) après création du membre ; un seul échec (cold-start Railway) bloquait l'écran « Entrer dans Wealthly ». **Fix** : tout best-effort + `setOnboarded(true)` dans `finally` (on entre toujours) + état loading sur le bouton.
- **Session expirée** : un 401 laissait l'user sur des données mortes. **Fix** : `api.js` émet un signal global (`subscribeSessionExpired`) sur tout 401 hors `/auth/*` → `App.jsx` déconnecte proprement + bandeau « session expirée » sur AuthScreen + purge cache.
- **2FA bloquante** : l'overlay 2FA obligatoire (sans échappatoire) bloquait tout nouveau compte. **Fix** : rendue **optionnelle** — bouton « Configurer plus tard » (`onSkip`), choix mémorisé (`localStorage wealthly:2fa_skipped`). Activable depuis Réglages → Sécurité. Backend 2FA OK (`/auth/totp/setup` testé 200).
- **Thème mobile « immonde »** : l'app suivait `prefers-color-scheme: dark` → ancien thème dark hors charte sur mobile. **Fix** : défaut **clair** partout (script no-flash `index.html` + `useTheme`) + **migration unique** (`wealthly-theme-default-light-v1`) qui reset les users déjà passés en dark. Dark dispo via toggle explicite.

### Bilan PDF — refait sur la VRAIE charte + logique correcte (`frontend/src/reportHtml.js`)
⚠️ **Leçon** : ne PAS inventer une charte (j'avais sorti du navy+or générique d'un plugin → rejet « immonde »). La charte = tokens `index.css` : papier chaud `#F7F6F2`, cobalt `#2540D9`, sage/terracotta, dataviz d1–d7, **Geist + Newsreader** (serif italique cobalt pour titres/gros chiffres). Génère un **HTML** imprimé par le navigateur (WYSIWYG, pas jsPDF — l'ancien `pdfReport.js` jsPDF est abandonné, plus branché). **Toujours vérifier le rendu** via headless Edge (`msedge --headless --screenshot`/`--print-to-pdf`) avant de livrer. **Logique** : comptes d'investissement (PEA/CTO/AV) valorisés depuis leurs **positions** (`parent_asset_id`) + cash, cours **live** via `api.quotes` ; immobilier **net du prêt lié** (`liability.linked_asset_id`). 2 pages : synthèse (hero net worth, KPI, donut, score, courbe aire) + détail en cartes par classe. Déclencheur : bouton « Bilan PDF » du Dashboard.

### Export Excel (`frontend/src/xlsExport.js`, SheetJS déjà installé)
Boutons dans les fiches détail (via `DetailShell.onExport`) : Investissements (positions) + Emprunts (échéancier `buildAmortization`). `exportLoansXlsx` (multi-prêts) dispo pour un bouton global futur.

### Email bilan mensuel (pilier 2/3 — shipped, voir aussi bloc 2026-06-06)
`Household.monthly_report_enabled` + `services/monthly_report.py` + `routers/reports.py` (settings / test / cron `X-Cron-Secret`). Toggle Réglages → Profil. **À FAIRE Railway** : cron mensuel POST `/reports/cron/send-monthly`.

### Restant / à faire
- Bouton **« agrandir » Sankey** (Monthly) : fix défensif posé (marges responsives mobile + garde data + z-index 2100) ; cause exacte desktop non confirmée (pas eu la console).
- **Comptes de test** créés en prod pendant les diagnostics (`wealthly.%@example.com`) → à purger : `DELETE FROM households WHERE id IN (SELECT household_id FROM users WHERE email LIKE 'wealthly.%@example.com');`
- `ANTHROPIC_API_KEY` **non posée** sur Railway (Coach + catégorisation 1-clic en fallback ; option « Sans clé » manuelle dispo).

---

## Session 2026-06-06 — Raphyy31 + Claude (Opus 4.7/4.8) — features P5, refonte fiches détail, RLS activé, IA contrôlée

Grosse série de sessions. **État repreneur : tout est sur `main`, déployé en prod.** Résumé de ce qui a changé depuis le 2026-05-19 :

### Nouvelles features (toutes live)
| Feature | Où | Détail |
|---|---|---|
| **Projection** (anticipateur de trésorerie liquide) | `views/Projection.jsx` | Courbe solde projeté 3/6/12M, marqueur du creux, sélecteur comptes liquides, CRUD d'événements ponctuels futurs. Modèle `PlannedEvent` + router `/planned-events` (mig `0011`). Phases calendrier + what-if **reportées**. |
| **Simulateur immo** | `views/ImmoSimulator.jsx` | Capacité d'emprunt HCSF 35%, mensualité (réutilise `buildAmortization`), notaire, reste-à-vivre, prix max. 100% frontend. |
| **Coffre-fort documents** | `views/Vault.jsx` | Upload/aperçu/suppression. Modèle `Document` + router `/documents` (mig `0012`). **Stockage = Postgres LargeBinary** (v1, plafond 8 Mo) — Supabase Storage = v2 possible. Pas de chiffrement applicatif. |
| **Coach IA + insights** | `components/AIInsights.jsx` (Dashboard) | Endpoint `/ai/insights` (POST snapshot → coach + alertes). **N'envoie que des agrégats, jamais les transactions brutes.** Voir "IA" plus bas. |
| **Moteur d'alertes** | `services/alerts.py` + `routers/notifications.py` + `components/NotificationBell.jsx` | Modèle `Notification` (dedup_key → scan idempotent, mig `0014`). 6 détecteurs déterministes à seuils conservateurs (découvert, budget dépassé, charge fixe non débitée, doublon, dépense inhabituelle, abonnement en hausse). Cloche + centre déroulant. **Pilier "Wealthly veille pour toi" 1/3** (reste : emails + rapport PDF). |

### Refonte UI — fiches détail patrimoine unifiées
`views/wealth/components/DetailShell.jsx` = châssis commun des **6 fiches détail** (RealEstate/Investment/Crypto/Liquidity/Liability/OtherAsset). Hero (pastille XL d'identité + titre 42px + valeur 48px Newsreader italique + badge delta), bande KPI colorée, sections, insight (`DetailInsight`), donut (`DetailDonut`), bridge (`DetailBridge`). `modal--detail` = 1100px. Header **sticky**. Système de **boutons unifié** "Option B" (primary = encre + halo cobalt) — défini dans `index.css`/`Styles.jsx`, anciennes classes legacy convergées.

### Système de boutons & modales
Boutons : un seul système, `.ds-btn` + classes legacy alignées (focus-ring WCAG partout, dark mode OK). Modales : scrim encre chaude, radius 16, anim scale-only, `ResponsiveModal` partout (desktop `.modal` + mobile vaul). **Piège passé** : une migration ResponsiveModal avait laissé un fragment texte `e.stopPropagation()}>` qui s'affichait dans ~14 modales (corrigé).

### 🔒 RLS Postgres — ACTIF EN PROD (lire avant toute requête DB)
- Mig `0013_enable_rls` : `ENABLE`+`FORCE RLS` + policy `RESTRICTIVE FOR ALL` sur **20 tables scoped foyer** (exclues : users, households, auth_events, password_reset_tokens). Mêmes policies ajoutées sur `notifications` (0014) et `ai_state` (0015).
- `auth.py:get_current_user` pose `SELECT set_config('app.current_household_id', <hid>, true)` à chaque requête. **`true` = LOCAL (transaction)**.
- **Rôle DB** : `DATABASE_URL` (Railway) utilise un rôle **`wealthly_app`** (Supabase, `NOBYPASSRLS`, peut faire du DDL → migrations OK). Le rôle `postgres` (BYPASSRLS) ne sert plus à l'app. Procédure complète : **`docs/RLS_ACTIVATION.md`**.
- ⚠️ **GOTCHA CRITIQUE** : `set_config(..., true)` est reset à **chaque COMMIT**. Tout service qui **commit plusieurs fois** dans une requête perd la variable → les requêtes RLS suivantes renvoient 0 ligne / WITH CHECK échoue. **Parade** : ré-affirmer `set_config(..., true)` au début de chaque accès (voir `services/ai_budget.py:_ensure_ctx`). Les endpoints à 1 seul commit ne sont pas concernés.
- Vérifier RLS via le catalogue (le SQL Editor Supabase n'est pas superuser → `SET ROLE` échoue 42501) : `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='accounts';`

### IA — coût maîtrisé (clé serveur unique, pas de BYOK)
- Clé : `ANTHROPIC_API_KEY` (Railway). **Coach = Sonnet** (`AI_MODEL_COACH`, défaut `claude-sonnet-4-5-20250929`), **catégorisation = Haiku** (`AI_MODEL_CATEGORIZE`).
- Garde-fous (`services/ai_budget.py` + table `ai_state`, 1 ligne/foyer, mig `0015`) : **cache Coach 24h** (`AI_COACH_CACHE_HOURS`, ~1 appel Sonnet/jour/foyer ; bouton rafraîchir = `force=true` ignore le cache) + **plafond mensuel** (`AI_MONTHLY_CAP`, défaut 300) → au-delà, fallback déterministe. Coût réel ~0,50 €/mois/foyer.
- Les **alertes sont 100% déterministes** (zéro token).

### Migrations Alembic : 0001 → **0015**
`0011_planned_events`, `0012_documents`, `0013_enable_rls`, `0014_notifications`, `0015_ai_state`. **Note** : `create_all()` + alembic tournent au boot (les migrations RLS s'appliquent au déploiement). ORM ≈ **23 tables** désormais (pas 14).

### Emails (pilier 2/3 — SHIPPED 2026-06-06)
DCA reminders **en place** (`DcaPlan.reminder_email_enabled` + cron Railway + Resend). **Bilan mensuel auto SHIPPED** : `Household.monthly_report_enabled` (opt-in, migration légère au boot main.py) + `services/monthly_report.py` (agrégation 100 % serveur : WealthSnapshot pour net worth+delta+alloc, transactions pour revenus/dépenses/épargne+top cat, fixed_charges pour reste-à-vivre ; HTML email-safe porté de la maquette papier-chaud) + `routers/reports.py` (GET/PUT `/reports/settings`, POST `/reports/test` = envoi immédiat au user courant, POST `/reports/cron/send-monthly` protégé `X-Cron-Secret`). **RLS gotcha cron** : le cron n'a pas de user → il fait `set_config('app.current_household_id', hh.id, true)` par foyer avant chaque lecture (households est hors RLS donc lister les opt-in marche sans contexte). Front : `api.reports` + `MonthlyReportToggle` dans Réglages→Profil (toggle + bouton test). Le digest hebdo a été **écarté**. **À FAIRE côté Railway** : créer le cron mensuel (ex. `0 8 1 * *`) qui POST `/reports/cron/send-monthly` avec header `X-Cron-Secret: $CRON_SECRET` (calquer sur le cron DCA existant). Pilier 3 PDF : `pdfReport.js` retravaillé (donut composition + Sankey flux) SHIPPED.

### Catégorisation IA — double voie (2026-06-06)
Bouton Transactions « Catégoriser via IA » = **1-clic serveur** (`categorizeViaServerAI` → `/categorize` Haiku plafonné). Bouton « Sans clé » = ancien flux **copier-coller manuel gratuit** (`AiPromptModal`, réutilise le Claude.ai/ChatGPT de l'user, 0 € API). Les deux coexistent (user veut vendre l'app sans imposer de clé). ⚠️ L'API Anthropic est **payante à l'usage** (séparée d'un abo Claude.ai) — user surpris ; coût réel < 1 €/mois avec cache+plafond. `ANTHROPIC_API_KEY` **PAS encore posée sur Railway** (Coach reste en fallback déterministe — désormais jamais vide — et le 1-clic renvoie « indisponible » tant que la clé manque).

### Renommage envisagé
Le user veut renommer l'app. Candidat retenu **"Cossu"** (FR = aisé/opulent, libre web). À valider domaine + INPI avant de basculer (~10 endroits : Logo, manifest, titre, emails, README).

---

## Session 2026-05-19 — Raphyy31 + Claude (Opus 4.7) — découpe + audit sécu expert + dark adouci

Suite directe de la session 2026-05-18. Plus calme côté UI, focus refactor +
audit cybersécurité approfondi (3 audits successifs : input/rate-limit, puis
Supabase data layer, puis low-level expert).

| Domaine | Commit(s) | Livré |
|---|---|---|
| **Découpe Wealth.jsx** | `b8a20e3` | 3 853 → 554 lignes (-86 %). 17 sous-fichiers `views/wealth/{components,editors,details,styles,utils}` |
| **Auto-déconnexion inactivité** | `805cc68` | `useIdleLogout` hook + `IdleTimeoutRow` dans Settings → Sécurité. Default 30 min, paramétrable 15/30/60/Jamais |
| **Découpe Settings.jsx** | `a748d07` | 2 120 → 196 lignes (-91 %). 17 sous-fichiers `views/settings/{sections,modals}` |
| **Audit sécu axe 1+2+3** | `76d1291` | Pydantic `max_length` sur tous champs texte, 6 nouveaux rate limiters (change-password 5/h, totp 5-10/h, transactions/import 20/j, categorize 100/j) |
| **Audit Supabase** | `7b070d1` | Banni les fallbacks `SECRET_KEY="CHANGE_ME_..."` + `DATABASE_URL` avec password en dur — refuse boot en prod si vars manquent. Helper `_require_env()` avec mode DEBUG |
| **Bug Sankey dark mode** | `090f595` | HALO label hardcodé `#F7F6F2` → `var(--bg)` (blocs blancs criards en dark) |
| **Dark mode Espresso doux** | `92c0515` | Lift global tokens : `#16140F → #1F1C16` (bg), `#1F1C16 → #2A2620` (elev), `#0F0D09 → #15130F` (sunk). Plus chaud, hiérarchie 3 niveaux lisible |
| **Audit low-level expert** | `405330c` | 9 fix XS (C1 missing Settings attrs, C2 stop leak `str(exc)` au client, H3 login step 2 TOTP frontend, H5 register message générique anti-énumération, M4 `hmac.compare_digest` CRON_SECRET, M6 RGPD cookie HttpOnly, F2 SHA-1→BLAKE2b dedup, F3 CORS methods/headers explicites) **+ 2FA obligatoire** (`Mandatory2FAOverlay` z-index 9999, non-dismissable, overlay tant que `currentUser.totp_enabled === false`. Admin compris, démo exemptée) |

**Tests** : 65/65 pytest backend verts. 28/28 vitest frontend (taxFr.js).

**Posture sécurité finale** : voir `docs/SECURITY_ROADMAP.md`.
- ✅ Auth (bcrypt, HIBP, JWT cookie httpOnly, brute-force lockout, rate
     limit auth + endpoints critiques, 2FA TOTP obligatoire + login step 2,
     auto-logout 30 min)
- ✅ Headers HTTP (HSTS, CSP, XCTO, XFO, Referrer, Permissions)
- ✅ Input validation (Pydantic max_length partout, SQLAlchemy ORM, React
     auto-escape, UUID4)
- ✅ Rate limiting (login 10/min, register 5/min, totp 5-10/h, change-pwd
     5/h, transactions/import 20/j, categorize 100/j)
- ✅ Audit log (AuthEvent + record_auth_event sur toutes routes sensibles)
- ✅ Secrets (aucun hardcodé, SECRET_KEY/DATABASE_URL obligatoires en prod,
     hmac.compare_digest pour CRON_SECRET, BLAKE2b pour dedup)
- ⏳ **Reste P0** : RLS Postgres (~1h30 dédié), invalidation JWT après
     change-password (`password_version`), validation X-Forwarded-For

**Reste à faire (TODO prochaine session)** :
- RLS Postgres + middleware SET LOCAL `app.current_household_id`
- H4 invalidation JWT après change-password
- H1 validation X-Forwarded-For contre proxies Railway
- **Bug remonté par user** : sync GoCardless figée (dernière op 15/05) —
  vérifier cron Railway, ajouter bouton refresh manuel visible + status
  "Synchronisé il y a Xh"
- P5 features brainstorm (compte employeur Swile, alertes intelligentes,
  projection retraite, scan ticket OCR)

---

## Session 2026-05-18 — Raphyy31 + Claude (Opus 4.7) — refonte UI/UX globale + GSAP + 2FA + tests

Grosse session (15 commits) après audit complet (UI/UX + animations + architecture).
Plan détaillé livré dans `docs/PLAN_2026-05-18.md` (22 chantiers / 6 phases).
**P1+P2+P3+P4+P6 livrées dans la journée**. Reste P5 features pour plus tard.

| Chantier | Commit | Livré |
|---|---|---|
| **C1** Tokens transversaux | `be72525` | Scale typo `--text-*`, dataviz +2 séries + softs, --focus-ring, --press-feedback, modes densité `[data-density]` |
| **C2** Composants atomiques | `42db02b` | `.ds-card--kpi/insight/drilldown`, `.ds-table` pattern relevé, `.ds-modal-*` scale-only, `.ds-drawer` clip-path, input states canoniques |
| **C3** Système numérique | `cb947bf` | `fmtAmount(value, mode)` 4 modes (hero/card/inline/delta), `formatDelta()` avec ▲/▼ Geist Mono, badge `.ds-delta` |
| **C4** Sidebar refonte | `0e30497` puis `6ade130` | Brand row + member filter en **pills horizontales** (variant C+D, choisi user) avec mini-avatars + active cobalt-soft. Suppression de la search bar `⌘K` placeholder et de tous les "§ 0X" |
| **C4** Dashboard refonte | `185308b` puis `6ade130` | KPI strip refondu : Patrimoine cash (liquidités+placements+épargne) / Patrimoine immo net (immo−crédits) / Épargne mois. Multi-deltas 30j/3M/YTD retirés (jugés peu utiles par user). Hero adaptatif état partiel (split actifs/passifs + bannière éditoriale). Empty states éditoriaux Newsreader italic. Compteur header sync visibleAccounts vs total |
| **C6/7/8** Polish | `4648990` | Dropdowns conformes design system (anim scale-only catDdFade + cmbPanelIn, focus-ring C1, no-translate), empty states italic sur Transactions/Monthly, `<select>` natif MergeModal → Combobox |
| **C9** Landing refonte | `71b424a` | Direction A masthead ("piloté avec rigueur"), 3 nouvelles sections : 4 icones Pourquoi (open-source/DSP2/sans pub/FR), Tarifs 3 cards (Solo/**Famille 5€**/Self-hosted GitHub), FAQ accordéon 4 questions, GitHub link colophon. Dark mode adouci `#0F0E0C → #16140F` (papier-chaud nocturne). GSAP setup (foundations C10 amorcées) avec gsap.matchMedia + DURATIONS + EASES exposés |
| **C10/11/12** GSAP | `7f4a640` | AnimatedNumber migré rAF → `gsap.to({val})` avec snap + reduced-motion. Modal entry scale-only (translateY retirée). HealthScore count-up synchronisé arc draw (ease expo.out signature). Cohabite avec Framer Motion existant sur Landing/Dashboard (pas de rewrite) |
| **C13** Catégorisation | `a75b55f` | **11 règles regex builtin** ajoutées depuis l'audit du CSV utilisateur de 204 tx : ECHEANCE PRET → loan_student, BNP Personal Finance → loan_consumer, PREDICA → insurance_life, FRAIS IRREG/intérêts → fees, HELIUM → reimbursements, NYX*/SELECTA/MCB → restaurants, M.OU MME → auto-virement, AMEX Carte-France → transfer. Bug helper pytest fixé en passant (account_id manquant → 22/28 tests faux). 28/28 tests verts |
| **C14** Récurrent | `78127a7` | Bouton "récurrent" manuel retiré des cartes Transactions. Badge auto en lecture seule. Auto-création FixedCharge après 3 obs **reportée** (banner + workflow à faire dans session dédiée) |
| **C15** Transferts internes | `78127a7` | Fenêtre détection 3j → 5j (SEPA lents). Nouveau panneau "Mouvements internes" sur Dashboard listant les paires du mois. Cohabite avec règles regex C13 + override per-tx + role compte |
| **Bug critique RefMonth** | `882fb3c` | `saveRefMonth` catchait toute erreur en silence → l'utilisateur a perdu son mois type sans toast. Fix : rollback optimistic + re-throw + RefMonthEditor.handleSave ne ferme la modale qu'en cas de succès |
| **C19** 2FA TOTP | `3298af1` | Backend pyotp 2.9 : `User.totp_secret/_enabled`, endpoints `/auth/totp/setup|verify|disable|status`, login flow exige `totp_code` step 2 si activé (401 `totp_required`). Frontend : `TwoFactorRow` + `TotpSetupModal` (QR via api.qrserver.com, secret manuel, input 6 chiffres mono) + `TotpDisableModal` (password + code optionnel). Audit log enrichi (totp_enabled/disabled/verify_failure). **Login step 2 frontend (écran code post-password) reporté** — backend prêt mais AuthScreen reste sur 1 étape. Workaround : ne pas se déconnecter avant l'implémentation step 2 |
| **C20** Tests vitest | `3298af1` | `frontend/vitest.config.js` + scripts `npm test` + `npm run test:watch`. `taxFr.test.js` : 28 tests, 7 describe blocks couvrant abattement, parts, barème, marginal, crédits + plafond 10k niches, computeTax bout-en-bout, compareWithPAS, constantes 2025. Garde-fou anti-régression sur les valeurs légales (mises à jour annuellement) |

**Direction visuelle ITÉRÉE** (pas figée — feedback user explicite 2026-05-18) :
- Suppression des "§ 0X" eyebrows partout (jugés moches par user) → labels uppercase mono sans préfixe
- Dark mode adouci `#0F0E0C → #16140F` papier-chaud nocturne
- Workspace switcher en pills horizontales (variant C+D) plutôt que dropdown

**Reste après cette session** :
- 5 tests `test_password_reset.py` qui fail (préexistants, non liés à C19) → à investiguer
- Login step 2 frontend (AuthScreen écran code TOTP) — bloquer cas user qui se déconnecte après activation 2FA
- Auto-création FixedCharge quand 3+ obs récurrentes (banner sur Transactions)
- Découpe Wealth.jsx 4 300 lignes (dette tech, non bloquant)
- Brainstorm features (compte employeur Swile, alertes, projection retraite, OCR ticket)

---


## Stack & deployment

| Layer | Tech | Where |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind v4 + Recharts | Vercel (auto-deploy from `main`) |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic 2 | Railway (auto-deploy from `main`) |
| Database | Postgres | Supabase |
| Email | Resend (HTTP API via httpx) | Backend `app/email_service.py` |
| AI | Anthropic Claude Haiku (categorization, BYOK) | Backend `app/routers/categorize.py` |
| CI | pytest + GitHub Actions | `.github/workflows/test.yml` |

**Production URL** : https://wealthly-six.vercel.app (Vercel preview hashes also work via CORS regex).
**Backend URL** : https://wealthly-production-45aa.up.railway.app
**Repo** : https://github.com/Raphyy31/wealthly

User's machine has: Homebrew, gh CLI (authenticated as `Raphyy31`), Git. **No node, no Docker, no Python locally**. So:
- Cannot run `npm install` / `npm run build` / `pytest` locally.
- Visual validation always happens on Vercel after push.
- User pushes commits **directly to `main`** (no feature branches, no PRs). Vercel auto-deploys.

---

## Repository layout

```
backend/
  app/
    main.py              FastAPI app + CORS middleware
    config.py            Settings class (env vars)
    database.py          Engine (SQLite or Postgres) + Base + get_db
    models.py            14 ORM tables
    schemas.py           Pydantic input/output models
    auth.py              JWT helpers (python-jose) + bcrypt password hashing
    defaults.py          Default category seed list
    email_service.py     Resend client. NEVER raises (returns False on failure).
    routers/
      auth.py            register, login, me, forgot-password, reset-password
      members.py         CRUD members
      accounts.py        CRUD bank accounts
      transactions.py    CRUD + bulk import
      wealth.py          CRUD assets, liabilities, wealth snapshots
      other.py           categories, budgets, goals, achievements, rules,
                         migration import
      categorize.py      Regex + AI categorization
      banks.py           GoCardless Bank Account Data — connect/sync flow
    services/
      gocardless.py      Thin httpx client over the GoCardless API
    rate_limit.py        slowapi Limiter + 429 handler (FR detail message)
  alembic.ini            Alembic config (URL via env, never hardcoded)
  alembic/
    env.py               Loads Settings.DATABASE_URL, registers Base.metadata
    script.py.mako       Revision template
    versions/
      0001_baseline.py   Marker — current schema is the baseline
  tests/                 pytest, in-memory SQLite, mocked Resend, limiter disabled
  pytest.ini
  requirements.txt       prod deps (now includes slowapi)
  requirements-dev.txt   + pytest, pytest-cov

frontend/
  public/
    manifest.webmanifest  PWA manifest
    icon.svg              Brand mark (gold W on near-black)
    icon-maskable.svg     Android adaptive icon
    sw.js                 Service worker (network-first shell)
  src/
    main.jsx                       Entry, registers SW in prod only
    App.jsx                        Auth gate + demo mode + reset_token URL handler
    AuthScreen.jsx                 Login | Register | Forgot | Reset modes
    BankCallback.jsx               Landing page after the bank OAuth redirect
    WealthlyApp.jsx                Main shell — data layer + sidebar/nav + view router (~1100 lines)
    TaxSimulator.jsx               Vue Impôts (lazy-loaded)
    Styles.jsx                     Global CSS-in-JS — pairs with index.css
    constants.js                   STORAGE_KEYS, DEFAULT_CATEGORIES/RULES, BANK_PROFILES, ASSET/LIABILITY_TYPES, MEMBER_PALETTE
    storage.js                     Tiny localStorage wrapper for UI prefs
    utils.js                       formatCurrency/Date, CSV parse, categorize, detectRecurring (no React)
    taxFr.js                       Pure tax engine (barème + parts + crédits)
    pdfReport.js                   jsPDF bilan generator (dynamic import on click)
    demoData.js                    Seed for demo mode
    api.js                         HTTP client. Demo-aware: GET returns null, POST throws.
    index.css                      Tailwind v4 + custom @theme tokens
    components/
      Toast.jsx                    Stateless toast renderer
      AnimatedNumber.jsx           rAF-tweened currency display (memoized)
      NetWorthChart.jsx            Brut/Net/Financier toggle + period selector (used by Dashboard + Wealth)
      HealthScore.jsx              0-100 SVG gauge + 5-criteria breakdown (Dashboard widget)
    hooks/
      useIsNarrow.js               Viewport breakpoint hook (used by Cashflow Sankey)
    views/
      Onboarding.jsx               3-step first-launch wizard
      Dashboard.jsx                Net worth hero + KPIs + composition + recent
      Wealth.jsx                   Patrimoine + all asset/liability editors + 5-step wizards
      Monthly.jsx                  Suivi mensuel + FixedChargeEditor (modal)
      Cashflow.jsx                 Sankey + donut + SankeyNode (memoized)
      Budgets.jsx                  50/30/20 + GoalEditor (modal)
      Transactions.jsx             Searchable + sortable + advanced filter panel (multi-cat / accs / members / dates / amount / type)
      Analysis.jsx                 Évolution + top marchands + per-category drill
      Settings.jsx                 SettingsView + CustomRules + BankConnections + InstitutionPicker + MemberEditor
      ImportFlow.jsx               4-step CSV wizard + MappingField (local helper)
  vite.config.js                   Tailwind plugin + /api proxy (dev only) + manualChunks for recharts/lucide/jspdf
  index.html                       PWA + iOS metadata + dark-flash prevention inline style

.github/workflows/test.yml     pytest on push/PR

README.md     User-facing project doc (deployment, features)
ROADMAP.md    What's done + what's next
CLAUDE.md     This file
QUICKSTART.md Outdated, kept for historical reference
```

---

## Visual direction (CRITICAL — charte « Forêt » 2026-06-27, don't deviate without asking)

**« Forêt »** — émeraude profond sur neutres papier verdâtre. Remplace l'ancienne charte « papier-chaud + cobalt » (2026-05-12) qui a tenu jusqu'à fin juin 2026.

Lineage (do NOT roll back to any of these): teal `#00d09c` (rejeté 2026-05-05), Méridien gold `#c5a572` (dark-only trop étroit, abandonné), papier-chaud + cobalt `#2540D9` (charte intermédiaire mai → juin 2026, abandonnée pour Forêt).

### Source of truth

`frontend/src/index.css` est LE fichier tokens. Light par défaut, dark via `data-theme="dark"` sur `<html>`. **Toujours mettre à jour les DEUX blocs** : le `@theme` Tailwind (en haut) ET le `:root` (en dessous). Oublier le `@theme` fait que les utilities Tailwind compilent encore aux anciennes valeurs (piège vécu lors de la bascule Forêt).

`frontend/src/Styles.jsx` consomme les mêmes vars.

### Key tokens (light, app default)

- `--bg` / `--bg-elev` / `--bg-sunk`: `#F7F9F6` / `#FFFFFF` / `#ECF1E9`
- `--ink` / `--ink-2` / `--ink-3`: `#10150F` / ~`#52584F` / ~`#86897F`
- `--accent` / `--accent-2` / `--accent-soft`: **`#0E7C56`** (émeraude) / `#0A5C40` / `#E1F1E9`
- `--positive` / `--negative` / `--warning`: vert sage / terracotta / ocre (mêmes hues que cobalt-era)
- `--d1..d7` dataviz: émeraude, sage, terracotta, mauve, pink, grey, ocre — ordre stable

### Key tokens (dark, landing + opt-in user theme)

- `--bg` Landing : `#0a0e08` avec halo radial émeraude
- `--accent` dark : **`#41D49B`** (émeraude lifted, plus saturé que le light pour ressortir)

### Typography (inchangée)

- **Geist** — sans-serif principal (400/500/600/700)
- **Geist Mono** — IBAN, codes, axes, eyebrow uppercase
- **Newsreader** — italic UNIQUEMENT, accents h1/h2 (mot d'attaque en Geist 500, mot italique en Newsreader 400/italic émeraude). Jamais Newsreader roman.
- Chargées via Google Fonts dans `frontend/index.html`
- `font-variant-numeric: tabular-nums` systématique sur tout monétaire

### Brand mark

Single source : `frontend/src/components/Logo.jsx`. **SVG carré émeraude `#41D49B` + carré sombre `#0C1009` intérieur centré** (proportions 0.375 calées sur le SVG du film). Couleurs FIXES en clair comme en sombre — c'est l'identité, pas un état UI. Seul le wordmark texte (`#10150F` en light, `#F1EEE4` en dark) suit `data-theme` via MutationObserver. Favicon + maskable SVGs (`frontend/public/icon*.svg`) reproduisent ce design. Bumpé `?v=4` dans `index.html` pour invalider le cache.

### Page header pattern (extend if you add a view)

```jsx
<div className="subview-header">
  <div>
    <h1>Lead <em>noun.</em></h1>
    <p>One-line subtitle.</p>
  </div>
  {/* optional action button */}
</div>
```

Le `em` dans h1 sous `.subview-header` (ou `.page-header`) prend automatiquement Newsreader italic + émeraude via `index.css`.

⚠️ **Piège em sélecteur global** : `index.css` ligne ~4605 a `:root h1 em, :root h2 em, …` qui force `font-style: normal; color: var(--ink)` (héritage de la session « anti tout-cobalt »). Toute mise en valeur émeraude italique DOIT utiliser un sélecteur plus spécifique pour battre la cascade (ex. `.film-hero h1.fh-title .fh-title-accent`) — sinon le mot reste en encre noire/invisible sur fond sombre.

### Rules

- **No translateY hover** sur la chrome de l'app (sidebar, header). OK sur les CTAs émeraude de la landing (`translateY(-1px)` au hover) — c'est marketing.
- **Halo émeraude** sur primary CTAs : `0 12px 32px -10px rgba(65,212,155,0.55)` (landing) / `0 4px 14px -4px rgba(14,124,86,0.25)` (app light).
- **Radii** — 4 / 6 / 8 / 12 / 16 dans l'app. Landing peut monter à 22-24 (carte film) pour le côté éditorial.
- **Single accent** : émeraude pour CTAs / data principale / liens. Sage positif, terracotta négatif, ocre warning. Sparingly.
- **Landing dark-only par force** (`Landing.jsx` pose `data-theme="dark"` au mount, restaure au unmount). `FilmHero.jsx` utilise des couleurs codées en dur pour ne pas dépendre du thème (le hero est toujours dark).
- **Pas de chauvinisme** sur la landing — pas de « Fait en France ».
- **PDF export** (`reportHtml.js`) reflète les tokens light Forêt.

---

## Auth flow

- Register / login → JWT en **cookie HttpOnly + Secure + SameSite=None** (set côté backend, illisible en JS). Plus de `localStorage`.
- Token expire après 7 j. Versionné par `User.token_version` — incrémenté à chaque change-password / disable 2FA → tous les anciens cookies invalidés.
- Cache user en `localStorage` (`w2:current_user`) UNIQUEMENT pour optimiser le first paint (éviter le spinner 5 s sur cold-start Railway). App.jsx pose `unauthed` immédiatement si pas de cache, valide en tâche de fond via `/auth/me`.
- **Modal popup** (depuis 2026-06) : la landing ouvre `AuthModal.jsx` en `createPortal` au-dessus, pas de navigation. Le plein écran `AuthScreen.jsx` n'est plus utilisé QUE pour le flow `?reset_token=…`.
- **2FA TOTP** optionnelle (bouton « Configurer plus tard » sur l'overlay 2FA), activable depuis Réglages → Sécurité. Backend exige code 6 chiffres step 2 si `User.totp_enabled`.
- **Session expirée** : `api.js` émet un signal global (`subscribeSessionExpired`) sur tout 401 hors `/auth/*` → App.jsx déconnecte + bandeau « session expirée » + purge cache user.
- **Reset token URL** : `?reset_token=…` → App.jsx force `AuthScreen` plein écran même si loggé, switch en mode reset, scrub l'URL.
- **Demo mode** : flag `localStorage wealthly:demo` → App.jsx rend WealthlyApp avec dataset `demoData.js`, court-circuit toutes les API (GET → null, mutations → toast « Mode démo »).
- **Pas de Google OAuth** : tentative juin 2026 abandonnée (cause du 500 login), voir bloc Session 2026-06-28.

---

## Things that bite

**1. CORS regex must match every Vercel URL.**
The default in `backend/app/config.py` is `^https://wealthly(-[a-z0-9-]+)?\.vercel\.app$`. If the user adds a custom domain, update `CORS_ORIGINS` env var on Railway OR adjust the regex.

**2. Resend free tier sender restriction.**
Default `EMAIL_FROM` is `Wealthly <onboarding@resend.dev>`. With this sender, Resend's free tier **only delivers to the email address used to register on Resend**. Any other recipient → 403 silently. Diagnostic path:
1. https://resend.com/emails — check Logs
2. Railway → Logs — look for `[email]` lines
3. Solution: either test with the Resend account's email, or verify a domain on Resend

**3. WealthlyApp is no longer a monolith.**
L1+L2 of the découpe shipped (commits 955143b → 8663654, 2026-05). The
file dropped from 6386 to ~1100 lines and now owns only the data layer
+ shell + view router. Sub-views live in `src/views/`, leaf components
in `src/components/`, hooks in `src/hooks/`. Sed-based extraction is
risky — the L2.4 Dashboard removal accidentally chewed into the start
of `WEALTH_SUBVIEWS` (fixed in bdd7ed3); always grep the boundary
before deleting.

Remaining work if/when needed:
- L3: split the data layer into hooks (`useMembers`, `useReload`,
  `useTransactions`…) so views can move to a context provider instead
  of receiving everything via props.
- L4: TypeScript? Tests? Out of scope for now.

**4. The frontend tax engine is in `taxFr.js` and is critical.**
- French income brackets 2025 (declared 2026): 0 / 11 497 / 29 315 / 83 823 / 180 294 / ∞
- Plafond quotient familial: 1 791 €/demi-part
- Décote: 889 € (single) / 1 470 € (couple), érosion 45.25%
- Crédit garde enfant <6 ans: 50%, plafond 3 500 €/enfant
- Crédit emploi à domicile (CESU): 50%, plafond 12 000 + 1 500/dépendant, max 15 000
- Plafond global niches fiscales: **10 000 €/foyer**

Update these constants when the law changes (typically late each year for the next year). The user explicitly removed `sharedChildren` (garde alternée) — don't add it back.

**5. The wealth snapshot auto-upsert.**
`WealthlyApp` posts a snapshot whenever net-worth math materially changes. Debounced 1.5s, gated by a useRef. Don't remove the gating — the deps array on the useEffect is intentionally `[netWorth, liquidWealth, assetsValue, liabilitiesValue]` and would otherwise spam the backend every render.

**6. CI tests.**
`pytest` runs against in-memory SQLite. The **email service is mocked** in conftest — DO NOT make password-reset endpoints depend on getting a real Resend response, the test patches `app.routers.auth.send_password_reset_email` and reads the captured emails via `client.sent_emails`. The **slowapi rate limiter is disabled** in conftest (`limiter.enabled = False`) — TestClient runs everything from one synthetic IP and would otherwise burn the budget within 2 cases.

**7. Alembic is set up but not the source of truth (yet).**
`Base.metadata.create_all()` still runs at startup as the fresh-DB safety
net. Alembic infrastructure (alembic.ini, env.py, baseline marker) is
posted in parallel: on first boot against a DB that has tables but no
`alembic_version` row, the startup hook stamps head — treats the current
schema as the baseline so future revisions can run cleanly. Going forward
every schema change should be a real alembic revision; eventually we
remove `create_all()` once we have a few real migrations validated in
prod. **Don't write a "full initial migration"** that re-creates all 17
tables — it would conflict with the existing schema.

**8. Rate limiting on auth.**
`slowapi` is wired on `/auth/login` (10/min), `/auth/register` (5/min),
`/auth/forgot-password` (5/min) per IP. The 429 message is the FR string
`"Trop de tentatives. Réessaie dans quelques instants."` — the existing
toast pipeline surfaces it without a special case. Limiter lives in
`app/rate_limit.py`; main.py and routers/auth.py share the same instance.

---

## When the user says…

| User says | Trigger |
|---|---|
| "reprends le ROADMAP" | Read this file (latest session block on top) + `docs/PLAN_2026-05-18.md` + `docs/SECURITY_ROADMAP.md`, summarize where we left off, ask which item to work on |
| "j'ai des commentaires sur X" | Listen first, gather all the points, propose grouped commits, then execute |
| "pousse tout" | `git status`, commit anything pending, `git push origin main` |
| Pastes an API key | **STOP**. Tell them to revoke it, generate a new one, set it on Railway as env var. Never read or commit the leaked one. |

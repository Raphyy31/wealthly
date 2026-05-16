# CLAUDE.md — context for AI assistants

Notes for Claude (and any future AI tooling) picking the project back up.
**Read this first** before making non-trivial changes.

> 📋 **Voir ROADMAP.md** pour la TODO list complète priorisée P0/P1/P2/P3.

---

## Session 2026-05-16 (suite) — Raphyy31 + Claude (Opus 4.7) — polish catégorisation + cron + vue récurrent + tests

Après la grosse refonte du matin (Payees + Learning + 120 règles), 5 chantiers de polish sur la même journée pour fermer les trous structurels mentionnés en debrief :

| Domaine | Changement |
|---|---|
| **Tests pytest moteur** | Nouveau `backend/tests/test_categorization.py` : 15 tests couvrant normalize (préfixes bancaires, dates, SEPA, accents, flags SELF_TRANSFER/LOAN_INSTALLMENT), engine builtin rules (Netflix → subs_video, Uber vs Uber Eats, Franprix, Revolut/AMEX règlement → transfer, marchand inconnu → uncategorized, EDF, ANTHROPIC, COTISATION Premium → fees), user_rule priority, Category Learning (création au seuil, pas de learning sans payee), apply-retroactively. Garde-fou anti-régression pour les prochains refactors. |
| **Persistance règles transfer** | Le mode 'Virement interne' dans `CreateRuleModal` ne flag plus juste les tx existantes en one-shot — il persiste maintenant une `CategorisationRule(rule_type='transfer')` via `api.rules.create`. Le moteur backend (engine.py couche user_rule) reconnaît `rule_type='transfer'` et flag les futurs imports + syncs GoCardless automatiquement. Une seule action user → effet permanent. |
| **Cron auto-sync GoCardless** | Refacto `_sync_one_connection()` helper réutilisable. Nouveau `POST /banking/cron/sync-all` qui itère toutes les connexions `status='authorized'` de TOUS les foyers, sync chacune (days_back=7 par défaut). Auth par header `X-Cron-Secret` matchant `settings.CRON_SECRET`. Script `backend/scripts/cron_sync_all.sh` curl wrapper pour Railway Scheduled Tasks. Sans ce cron, les données pourrissaient tant que l'user ne cliquait pas Sync. |
| **Vue Charges récurrentes** | Nouvelle vue `views/Recurring.jsx` accessible via sidebar (groupe Gestion, icône Repeat). Liste tous les paiements récurrents du foyer (loyer, mutuelle, assurances, électricité, abonnements, prêts…) — différent de SubscriptionsWidget qui ne couvre que la branche subscriptions du Mois type. Hero summary (mensuel total / annuel projeté / nb marchands), filtres search + cat, sort par annuel/mensuel/freq/last, table responsive. Clic ligne → ouvre Transactions filtrées sur le compte. |
| **Toggle apprentissage** | `Household.auto_learning_enabled` boolean default True. Endpoints `GET/PUT /learning/settings`. Composant `LearningToggle` en haut de Réglages → Catégories & règles. Si désactivé, `on_transaction_recategorized` retourne `None` sans créer de règle. |

**Configuration requise sur Railway** pour activer le cron :
1. Variables → `CRON_SECRET=<long_random_string>`
2. Scheduled Tasks → `0 4 * * *` (04h UTC) → command : `bash backend/scripts/cron_sync_all.sh`
3. Env du task : `BACKEND_URL=https://wealthly-production-45aa.up.railway.app` + `CRON_SECRET=<même valeur>`

**Hotfix Railway de la matinée** : `unicodedata.normalize` à la place de `str.maketrans` (typo dans la table d'accents qui crashait le boot). Voir bloc précédent.

---

## Session 2026-05-16 — Raphyy31 + Claude (Opus 4.7) — refonte moteur de catégorisation v2 (Payees + Learning + 120 règles builtin)

Chantier majeur prévu depuis le 2026-05-15 (gros prompt rédigé par l'utilisateur inspiré d'Actual Budget). Mergé en plusieurs commits atomiques sur `main`. Une grosse régression au déploiement Railway (typo dans la table d'accents `maketrans`) a été corrigée en suivant.

**Livré** :

| Domaine | Changement |
|---|---|
| **Module backend `app/categorization/`** | Nouveau package qui sépare la catégorisation du router. `normalize.py` : extrait merchant + operation_type + flags (SELF_TRANSFER, LOAN_INSTALLMENT, REFUND, FOREIGN) du libellé brut, désaccente via `unicodedata.normalize('NFKD')`. `rules.py` : ~120 règles builtin compilées (transports, courses, abos, santé, restaurants, voyages, impôts), chaque règle attachée à un Payee canonique (Uber, Franprix, MAIF, etc.). `engine.py` : moteur déterministe 5 couches `user_rule → payee_default → learned_rule → builtin_rule → llm → unknown`. `learning.py` : `on_transaction_recategorized()` crée auto une `CategorisationRule(created_by='learning')` après `LEARNING_THRESHOLD=2` observations du même payee → même catégorie. |
| **DB** | Nouvelles tables `payees` (nom canonique scopé foyer, `default_category_id`, `is_transfer`) + `payee_match_rules`. `CategorisationRule` enrichi : `created_by` (user/learning/builtin), `rule_type` (category/transfer), `payee_id` FK, `priority`, `updated_at`. `Transaction` enrichi : `payee_id` FK + `cat_source` (audit). Migrations légères ALTER IF NOT EXISTS au boot. |
| **Endpoints** | `routers/payees.py` (nouveau) : CRUD `/payees` + `/payees/{id}/merge/{other}` (fusion) + `/categorize/preview` (passe un libellé dans le moteur sans rien sauver). `POST /transactions/rules/{id}/apply-retroactively` : applique une règle aux tx historiques d'un même payee (utilisé par le snackbar de learning). |
| **Intégration imports/sync** | `routers/transactions.py` bulk import passe par le moteur quand pas de slug fourni. PUT déclenche le hook learning. `routers/banking.py` : sync GoCardless catégorise auto chaque tx au moment de l'insert → fini le « Catégoriser via IA » manuel à chaque sync. |
| **Frontend — badges source** | `txFromApi` propage `payee_name`, `cat_source`, `payee_id`. Sur les cartes Transactions, nom du payee canonique affiché en discret après le libellé. Dot coloré indique la source (`user_rule` vert sage, `payee_default` cobalt, `learned_rule` mauve, `builtin_rule` gris, `llm` bleu clair) avec tooltip explicite. |
| **Frontend — Réglages** | Section `PayeesSection` ajoutée (Mes catégories → Marchands canoniques → Règles). Liste tous les payees du foyer, badge `AUTO` si créé par builtin rules. Renommage inline, toggle `is_transfer`, **fusion** (clic ⇆ source puis clic cible), suppression. Filtre par nom. La section `CustomRulesSection` a maintenant 4 chips de filtre (Toutes / Manuelles / 🧠 Apprises / ↔ Virement), badge `🧠 Apprise` sur les règles auto-créées, pill spécifique cobalt soft pour les règles `rule_type='transfer'`. |
| **Toast Category Learning** | Quand la PUT `/transactions/{id}` retourne `learned_rule` (le hook a créé/maj une règle apprise), une bannière persistante apparaît en bas centre : « 🧠 Wealthly a appris : Franprix → Courses. Appliquer aux N transactions historiques ? [Appliquer] [Plus tard] ». Clic Appliquer → POST `/apply-retroactively` → reclasse toutes les tx du même payee non manuellement catégorisées + reloadAll. |
| **AI prompt modal — refonte générique** | Le prompt généré par `AiPromptModal` est restructuré en 6 étapes (scan récurrence, web search opt-in, règles de catégorisation, quand mettre uncategorized, transferts internes, few-shot universels). Section finale "Format de réponse — STRICT" avec liste INTERDIT explicite (pas de fences markdown, pas de préambule, pas d'artefact, pas de slug `transfer`, pas de nom FR). Côté parser : strip fences ```json``` auto, fallback nom FR → slug, normalisation slug avec espaces/majuscules, comptage des entrées rejetées dans le message d'erreur. Slugs dupliqués/test filtrés du prompt envoyé au modèle (sport/pharmacy/streaming/childcare → masqués au profit des canoniques subs_gym/health_pharmacy/subs_video/children_childcare). |
| **Hotfix Railway** | Le boot Railway crashait avec `ValueError: the first two maketrans arguments must have equal length` car ma table d'accents avait un `O` en trop dans chaque groupe. Remplacé par la méthode canonique Python `unicodedata.normalize('NFKD')` + filtre des marques combinantes. Plus robuste + impossible à casser par typo. |

**Test réel sur 100 tx (Crédit Agricole + AMEX, prompt + Claude.ai)** : qualité de catégorisation très solide. Revolut correctement détectés comme `uncategorized` (transferts internes), AMEX `PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI` en uncategorized, `DÉPENSE ÉCHELONNÉE` pair OK, ANTHROPIC → subs_cloud, COTISATION Offre Premium → fees, marchands fashion (Kith, Axel Arigato, La Redoute, H&M, Work In Progress) → shop_clothing. Erreurs surtout sur les marchands obscurs sans contexte (SAS 02 MER, CDLR REIMS, BOKOBZA ETHEL).

**Reste à faire (P2/P3)** :
- Tests pytest fixtures sur le moteur (fixture `credit_agricole_sample.json` avec 30 tx de référence)
- Toggle « Apprentissage automatique des catégories » dans Réglages (toujours on par défaut pour l'instant)
- Persister les règles `rule_type='transfer'` qui sont actuellement appliquées en one-shot via `setTransferOverride` côté frontend (n'agit pas sur les imports futurs)
- 2FA TOTP (toujours en attente)
- Cron Railway auto-sync GoCardless nightly + email re-consent J-7

---

## Session 2026-05-15 — Raphyy31 + Claude (Opus 4.7) — catégories user + règles dual-select + Mois type modal + Compte courant

6 commits push directs sur `main` (workflow no-PR). Commit principal `1ec712f`, suivi de 5 itérations ciblées suite aux retours user en live (UX feedback, cohérence cross-app).

**Livré** :

| Domaine | Changement |
|---|---|
| **Catégories user (backend)** | Nouveaux endpoints `POST /categories` et `DELETE /categories/{slug}` dans `routers/other.py`. Création avec slugify ASCII (`unicodedata.normalize` + `re`), suffixage `-2/-3` si collision, validation parent existant + interdiction sous-sous-catégorie (taxonomie 2 niveaux preservée). Delete cascade : détache `Transaction.category_id`, drop `CategorisationRule` + `Budget` pointant vers le slug ou ses enfants. `CategoryCreate` schema dans `schemas.py`. |
| **Catégories user (frontend)** | `api.categories.create` / `api.categories.delete`. Nouvelle section `MyCategoriesSection` en haut de la sous-vue Réglages → « Catégories & règles » : liste hiérarchique avec chip parent + chips sous-cat, bouton « + Catégorie » (top-level) et « + » par parent (sous-cat). Modale `CategoryCreateModal` avec picker icône (20 emojis), couleur (12 swatches issus des dataviz d1..d7) et type (dépense/revenu/virement) ; sous-cat hérite du type parent. Confirmation native sur delete. |
| **Toast + optimistic update** | `showToast` passé à SettingsView. Sur create/delete, `onCategoryCreated(apiCat)` / `onCategoryDeleted(slug)` patchent l'array `categories` localement **avant** le re-fetch GET — UX instantanée même quand Railway cold-start (le user voyait un délai de 30s avant ce fix). `reloadCategories` reste comme filet de sécurité en background (sans `await`). Toast vert "Catégorie X créée" / "Détail Y créé" / "Z supprimée". |
| **Règles dual-select** | Formulaire « + règle » dans `CustomRulesSection` (Settings.jsx) refait : grid 4 colonnes `pattern + Catégorie + Détail + Add`. `newTopId` / `newSubId` séparés, `targetSlug = newSubId \|\| newTopId`. Détail optionnel — si vide, la règle cible le top-level. Liste des règles affiche maintenant `Parent › Détail` (chevron `›`) au lieu du slug brut. |
| **CreateRuleModal refait** | Modale post-recatégorisation manuelle : ajout des deux selects Catégorie + Détail (Détail désactivé si pas de sous-cat). `onConfirm` signature changée `(keyword) → ({ keyword, categoryId })`. `WealthlyApp.applyRule` recat la tx déclencheur si l'utilisateur a choisi un slug différent de celui appliqué initialement. `countRuleMatches` accepte un slug cible. |
| **Filtre Transactions** | Ligne « ❓ Non catégorisé » ajoutée explicitement dans le filtre header de la colonne Catégorie (était filtrable via le panneau avancé mais pas dans le picker rapide). Compte `catCounts['uncategorized']` réutilisé. |
| **Mois type modal** | `RefMonthEditor` passé du drawer latéral 520px à une grosse modale centrée 1080px (`.modal-backdrop` + `.modal.rm-modal`), layout 2 colonnes : Entrées + Épargne à gauche (`0.95fr`), Dépenses à droite (`1.15fr`). Single column sous 880px. Header de section enrichi : icône + label + total agrégé à droite. Inputs labellisés agrandis (font 14px, padding 8×10, border + focus accent-soft, radius 8). Empty-state en dashed border centré. Anciennes classes `.ref-month-backdrop` / `.ref-month-drawer` retirées d'`index.css`. |
| **Compte courant (Patrimoine)** | Nouveau type `checking_account` (icône Wallet, cobalt) en tête de `ASSET_TYPES` dans `constants.js`. Mappé sur la classe Liquidités dans `ASSET_CLASS_MAP` et sur le subtype canonique `compte_courant` dans `BACKEND_TO_SUBTYPE`. Le donut Patrimoine agrège correctement. |
| **Fix 50/30/20 bucket Mois type** | `FiftyThirtyTwentyModal.bucketRefMonth()` lisait un set hardcodé de slugs `['housing','utilities','insurance',...]` pour classer Besoins/Envies/Épargne. Les catégories user-créées tombaient toujours en "Envies" peu importe le `kind` choisi. `classify(catId, categories)` lit maintenant `cat.kind` (source de vérité), fallback sur les slugs si pas dispo. `categories` propagé depuis Monthly.jsx. Note : le bucket "mois courant" lisait déjà `cat.kind` correctement dans `fiftyThirtyTwenty` (WealthlyApp), seul le bucket "Mois type" avait le bug. |

**Audit cohérence cross-app** validé : les user-cats sont propagées correctement dans Transactions (filtre + picker + recherche), Analyse, Mois type, CreateRuleModal, ImportFlow, Dashboard, Cashflow, Monthly, sync GoCardless, import CSV, PATCH /transactions (résolution par slug scopé household via `_resolve_category_id`).

**Pas touché à** : la couche de catégorisation regex/IA elle-même (Payees + Learning + builtin rules) — le user a un prompt prêt pour la prochaine session.

**Limitations connues** (à traiter dans session i18n / refonte catego) :
- `MyCategoriesSection` + `CreateRuleModal` + dual-select rules form sont **100% FR** (pas de clés `t()`).
- `RefMonthEditor.STARTER_TEMPLATE` seed avec slugs hardcodés (`'salary','housing',…`). Si l'user supprime ces cats par défaut, le seed pointera vers rien (modale gère le cas — picker vide).

**Reste à faire** :
- 2FA TOTP (toujours)
- Cron Railway auto-sync GoCardless + email re-consent J-7
- **Refonte catégorisation Payees + Category Learning + 120 règles builtin** (prompt complet rédigé par l'utilisateur, à exécuter dans une session dédiée) — c'est le prochain gros chantier
- i18n EN pour les composants 100% FR de cette session

---

## Session 2026-05-14 — Raphyy31 + Claude (Sonnet 4.6 puis Opus 4.7) — parallel agents salve

Session conduite avec 4 puis 3 agents en parallèle dans des worktrees (`feature/comparer-mois`, `feature/dca-polish`, `feature/i18n-audit`, `feature/jwt-cleanup`, puis `feature/dca-tracking`, `feature/comparer-tune`, `feature/i18n-sweep`).

**Livré (~12 commits)** :

| Domaine | Changement |
|---|---|
| **JWT cleanup** | Suppression du legacy `localStorage` token (`LEGACY_TOKEN_KEY`, `getToken/setToken/clearToken`, header Bearer côté navigateur). L'auth passe exclusivement par le cookie httpOnly `trove_session`. Bearer fallback conservé backend pour pytest. **Utilisateurs existants déconnectés au déploiement** (cookie absent → AuthScreen). |
| **DCA polish** | `useQuotes` branché : "Valeur actuelle" si quote dispo, "Valeur théorique" sinon. PlanCard migré du shell bespoke (border-left cobalt) vers `.card` + `.card-header` canoniques. Accent cobalt déplacé dans le titre + chip ticker. |
| **DCA tracking** | Nouvelle colonne JSON `dca_plans.executions` (map `YYYY-MM` → bool). Migration `IF NOT EXISTS` au boot. Endpoint `PUT /dca/{plan_id}/executions`. UI : chip timeline 12 derniers mois cliquable (toggle payé/sauté, optimistic), indicator "N mois sautés" en ocre dans `card-meta`. `realCurrentState`/`theoreticalState` respectent `executions`. Tests pytest : default, replace, regex `YYYY-MM`, 404, isolation cross-household. |
| **Comparer mois Dashboard** | Nouvel insight `categoryCompare` useMemo : ratio mois courant / moyenne 6m (hors mois courant). Seuils permissifs `cur > 30 €` et `\|Δ\| > 15 %`. Fallback : si aucune catégorie ne passe le seuil, surface la plus grosse mouvement en variant neutral (Sparkles). Variant `neg` hausses, `pos` baisses. Cap 3 insights total. |
| **i18n EN sweep** | ~180 clés EN ajoutées : Dashboard (sections, insights, filter chips, allocation empty, sync states), DCA (toutes les KPI ProjectionHero + PlanCard + PlanModal), Settings (7 sections + ChangePasswordModal + CustomRules + BankConnections + MemberEditor + reset confirms), Wealth (`WEALTH_SUBVIEWS`, KPIs, allocation, empty states), AuthScreen (4 modes + validations), WealthlyApp (~25 toasts + confirms + `toasts.genericError`). Resté FR : Settings sub-section h2, modal editor h2, Wealth subview labels du tableau, body insights `rate < 0` / `else`, helpers `relTime`/`prettyDay`/`prettyType` (module-level sans accès à `t()`). |
| **Admin** | Onglet Foyers retiré (table Patrimoine net + Actifs bruts + Passifs). KPIs "Foyers" et "Actifs suivis" retirés du Vue d'ensemble. Ligne "Foyer :" du détail user retirée. "foyer(s)" renommé "compte(s)" dans les chips + table Abonnements. Imports `Home`/`ChevronUp`/`ChevronDown` nettoyés. |
| **Wizard emprunt complet** | Refonte `AddWealthModal` : quand `category === 'emprunts'`, le step `form` capture tous les champs liability dès la création (capital initial/restant en 2 colonnes, mensualité/taux, durée/date début, bien rattaché si mortgage, section repliable "Options avancées" : apport, assurance, frais de dossier, quote-part). API forward tout vers `liabilities.create` en snake_case. Plus besoin d'ouvrir l'éditeur après création. |
| **Bug `memberIds` → `member_ids`** | Le wizard envoyait `memberIds` (camelCase) à l'API qui attend `member_ids` (snake_case) ; Pydantic ignorait silencieusement le champ → les actifs/comptes/emprunts créés via le wizard n'étaient en réalité assignés à aucun membre. Fix dans les 3 branches d'`api.wealth.create`. |
| **API version bump** | `2.0.0` → `2.1.0`. Force déclenché parce que Railway était figé 3 commits derrière (cause des 404 sur `/me/wipe` et `/auth/change-password` reportés par l'utilisateur). |
| **CSS** | `.form-row-2col` ajouté à `Styles.jsx` (grid 1fr 1fr, fallback 1 col < 540px) pour le wizard emprunt. |

**Pattern parallèle** : worktrees créés en local (`git worktree add`), `node_modules` symlinké pour partager les deps, agents dispatchés en `run_in_background`, merges en cascade ensuite avec résolution manuelle des conflits sur `locales/*.json` + DCA.jsx.

**Reste après cette session** :
- 2FA TOTP (table `totp_secrets`, endpoints setup/verify/disable, flow login step 2)
- Cron Railway auto-sync GoCardless nightly + email re-consent J-7
- i18n : Settings sub-section h2, modal editors, Wealth subview labels via `WEALTH_SUBVIEWS`, helpers FR de Dashboard.jsx
- WealthlyApp.jsx découpe L3 (extract data hooks) — déprioritisé
- Frontend tests vitest sur `taxFr.js`
- Mobile bottom nav : 6 slots, décision pendante sur Plus overflow

---

## Session 2026-05-12 — Raphyy31 + Claude (Opus 4.7) — design freeze + Monthly + GoCardless

**Livré (gros chantier multi-heures, ~25 commits)** :

| Domaine | Changement |
|---|---|
| Landing | Promu LandingC → Landing.jsx (figé). Texte simplifié style Finary/Lydia ("Votre patrimoine, *enfin clair.*"). Suppression LandingB.jsx, design-b/d/e.html, Dashboard.legacy.jsx, refs "Disponible/Fait/Hébergé en France". |
| Brand | `components/Logo.jsx` unifié (auto-flip cream/ink selon `data-theme`). Utilisé partout : Landing, AuthScreen, sidebar desktop, mobile header, drawer mobile. Favicon + maskable SVG refaits (cream-on-ink "W"). PWA manifest Trove → Wealthly. Toutes les refs "Trove" dans le code remplacées. |
| Typo site-wide | Newsreader italic accent sur tous les h1 des vues (`Votre <em>patrimoine.</em>`, `Vos <em>transactions.</em>`, `Bonjour <em>Raphaël</em>`, etc.). Source Serif 4 (non chargée) remplacée par Newsreader partout. |
| Design tokens | Cobalt drop-shadow sur les .ds-btn.primary site-wide. Sidebar active nav : barre cobalt 3×18 à gauche. translateY hover banni. |
| Mobile | Demo banner compact "Mode démo". Boutons Dashboard icon-only sur ≤640px (Bilan PDF + Sync). Role-badge "ENF" masqué sur les chips membre. Settings → Comptes bancaires : selects rôle/devise pleine largeur sur ligne 2. backdrop-blur des sticky chrome papier-chaud. |
| PDF | `pdfReport.js` palette swappée vers v3 papier-chaud + cobalt + sage/terracotta + dataviz d1..d7. C.gold/C.goldDark mappés sur cobalt en alias (legacy callsites). |
| **Suivi mensuel** | **Rewrite complet** : carrousel mois sticky (15 mois, cobalt sur courant) + card synthèse (Revenus reçus/prévus, Dépenses faites/budgétisé, Épargne estimée gros vert) + table à 4 colonnes (Catégorie/Budgétisé/Dépensé/Solde) groupée en 5 buckets pliables (Charges fixes / Abonnements / Dépenses variables / Opérations neutres / Revenus). Onglet Évolution embarque l'ancien chart 6 mois. **Cashflow retiré du nav sidebar** (route conservée en fallback). |
| Fixed-incomes | Nouveau `fixed_charges.kind` column ('expense' default, 'income'). Toggle Dépense/Revenu dans `FixedChargeEditor`. Revenus fixes (salaire, APL…) sous le groupe Revenus avec budgétisé. Migration lightweight au boot. |
| Budgets inline | `budgets` + `setBudget` passés à Monthly. Variable rows ont une cellule Budgétisé éditable inline (clic → input → Enter pour valider). Budgétisés et dépensés agrégés dans le head du groupe Variables. |
| **GoCardless** | **Pivot complet Enable Banking → GoCardless Bank Account Data** (ex-Nordigen). config.py : ENABLE_BANKING_* → GOCARDLESS_SECRET_ID/SECRET_KEY/REDIRECT_URI. `routers/banking.py` rewrite complet (~400 lignes) avec token cache async, _gc() helper, flow /institutions → /agreements/enduser → /requisitions → callback ?ref= → /accounts/{id}/details → /transactions. Frontend api.js + WealthlyApp callback parser + Settings copy mise à jour ("GoCardless" partout). |
| GoCardless fixes | Modal envoie bank.id (institution_id) au lieu de bank.name. max_historical_days/access_valid_for_days cap par institution (lit transaction_total_days). Account.external_id + Account.source columns + lightweight migration. Sync utilise initial_balance (vraie colonne), Transaction insert avec dedup_hash. Auto-attach household_members aux nouveaux comptes (visibilité). Type d'account heuristique (PEA / livret / assurance vie / credit / checking) depuis product + cashAccountType. Response inclut maintenant {imported, updated, skipped, errors[]}. |
| Cleanup | Suppression `frontend/public/landing/*.png` (1 MB de PNGs orphelins). Commentaire "Hub tabs supprimées" supprimé (était juste de la doc d'absence). |
| Docs | Section "Visual direction" de ce CLAUDE.md réécrite pour le système v3 papier-chaud + cobalt. |

**Direction visuelle FIGÉE le 2026-05-12** — voir la section "Visual direction" plus bas. Ne plus revenir à : teal, or Méridien, Source Serif 4 (non chargée), `?design=b|c` query params.

**État GoCardless** :
- Connexions à banques françaises OK (BoursoBank, BNP, Crédit Agricole testés)
- Sync importe les transactions + auto-crée le compte Wealthly avec heuristique de type
- Reste à faire : auto-sync cron nightly, écran de re-consent quand session expire (90 j max).

**Reste après cette session (pour la prochaine conversation)** :
- Code cleanup plus profond : extract data layer hooks de WealthlyApp.jsx (1100 lignes), split Styles.jsx (1500 lignes) ou migration vers index.css
- 2FA TOTP, fin de la migration JWT cookies (legacy localStorage encore)
- Auto-sync cron Railway + email de renouvellement consentement GoCardless

---

## Session 2026-05-10 — kdtheory + Claude (Sonnet 4.6) — round 2 : implémentation

**Livré dans cette session** :

| Fichier | Changement |
|---------|-----------|
| `backend/alembic/versions/0002_security_phase1.py` | Migration Alembic défensive (IF NOT EXISTS) pour `auth_events` table + `users.full_name/is_active/is_admin` |
| `backend/scripts/seed_admins.py` | Script one-shot pour créer/promouvoir 2 admins via env vars `ADMIN_1_EMAIL/PASSWORD/NAME` + `ADMIN_2_*` |
| `backend/app/routers/admin.py` | + `PUT /admin/users/{id}/toggle` (suspend/réactiver) + `DELETE /admin/users/{id}` (suppression avec guards) |
| `frontend/src/api.js` | + `admin.toggleUser(id)` + `admin.deleteUser(id)` |
| `frontend/src/views/Admin.jsx` | + colonne Actions dans la table users (boutons Suspendre/Réactiver/Supprimer avec double-confirm) |
| `frontend/src/demoData.js` | - "Virement loyer" 1400€ → "Charges copropriété SYNDIC" 260€ ; + virements mensuels Alice→joint 1800€ + Bob→joint 1600€ (joint account ne va plus en négatif) |
| `frontend/src/views/Dashboard.jsx` | Fix `tx.description→tx.label`, `tx.account_id→tx.accountId`, `tx.category_id→tx.categoryId` dans widget Activité récente ; label donut "Net"→"Actifs" |

**Vérifications JWT httpOnly** :
- ✅ `set_auth_cookie` dans auth.py : httpOnly=True, Secure=True, SameSite=None (cross-site car API et frontend sont sur des domaines différents)
- ✅ `credentials: 'include'` dans api.js
- ✅ fallback Bearer header pour les sessions existantes
- ✅ `/auth/logout` efface le cookie

**Pour lancer la migration Alembic en prod** :
```bash
# Sur Railway (depuis le root du repo)
alembic -c backend/alembic.ini upgrade head
```
Ou Railway peut le faire automatiquement si `alembic upgrade head` est dans la startup command.

**Pour créer les 2 admins** :
```bash
# Définir en Railway Variables :
ADMIN_1_EMAIL=ton@email.com  ADMIN_1_PASSWORD=xxx  ADMIN_1_NAME="Kevin"
ADMIN_2_EMAIL=raphael@email.com  ADMIN_2_PASSWORD=xxx  ADMIN_2_NAME="Raphaël"
# Puis :
railway run python backend/scripts/seed_admins.py
```

**Ce qui reste à faire** :
- 2FA TOTP (backend pyotp + frontend écran code)
- Tests pytest pour les nouveaux endpoints admin (toggle + delete)
- YTD % toujours calculé sur bank accounts vs full patrimoine (architectural — nécessite wealthSnapshots en démo)

---

## Session 2026-05-10 — kdtheory + Claude (Sonnet 4.6)

**Contexte** : analyse live du site + planification backend sécurité + admin.

**Bugs identifiés sur la démo (à corriger en P0)** :
1. `demoData.js` — double comptage logement : "Virement loyer" −1 400 € + "Échéance prêt immo" −1 150 €. Un propriétaire ne paie pas de loyer. Remplacer par "Charges copropriété" −250 €.
2. Dashboard — widget "Activité récente" : libellés "—" et catégories "Non catégorisé" (fonctionne sur /transactions → régression post-refonte Dashboard.jsx).
3. Dashboard — donut allocation : label "NET" faux, affiche ~515 000 € (actifs bruts) au lieu du patrimoine net ~284 000 €.
4. Hero Dashboard — YTD +1257 % absurde. Probable : `getDemoData()` ne retourne pas de `wealthSnapshots` → calcul compare à zéro.

**Ce que Raphyy31 a livré (2026-05-09/10)** :
- Rebrand Wealthly → Trove (logo, landing v2, tarifs 3 plans, FAQ)
- `security.py` : audit log AuthEvent, brute-force lockout (5 échecs → blocage 30 min), HIBP check, CSP/HSTS headers
- `admin.py` router + `Admin.jsx` vue (lecture seule : stats + auth events + users)
- Hooks multi-devise : `useBaseCurrency`, `useQuotes`, `useRates`
- `demoData.js` réécrit (LCL compte joint corrigé, transactions réalistes Paris cadre)

**Ce qui reste côté sécurité (notre focus)** :
- Migration Alembic pour AuthEvent + is_admin + full_name (tables créées via create_all mais pas de revision → cassé en prod sur DB existante)
- Script `seed_admins.py` pour créer kdtheory + Raphyy31 en is_admin=True
- JWT → httpOnly cookies (encore en localStorage → XSS)
- 2FA TOTP (obligatoire pour is_admin)
- Admin actions : suspend/delete user (panel actuel = read-only)

**Décisions** :
- kdtheory se focus sur backend sécurité + admin (pas le design)
- Raphyy31 revoit le design/landing avec Claude Design cette semaine
- Nom "Trove" : on ne vérifie pas encore le trademark — ça attend la fin du dev
- Repo reste public (Raphyy31 owner) + CLAUDE.md reste dans le repo pour sync des sessions

**Persona démo cible** : couple Paris, Alice 3 850 €/mois + Bob 3 220 €/mois, propriétaires (prêt 1 150 €/mois à 1.65%), 1 enfant (crèche 680 €/mois), épargne Livret A 600 €/mois. Reste à vivre réaliste ~3 335 €/mois après charges.

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

## Visual direction (CRITICAL — figé 2026-05-12, don't deviate without asking)

**"Papier chaud + cobalt sobre"** (Wealthly v3 — Refonte Claude Design).

Lineage (do NOT roll back to any of these): teal/emerald `#00d09c` rejected 2026-05-05 ("fait plus sérieux"); Méridien gold `#c5a572` shipped briefly then abandoned because the dark-only direction was too narrow. The current cobalt + cream papier chaud system works in both light (app default) and dark (landing cover) modes and is the one to extend.

### Source of truth

`frontend/src/index.css` is THE token file. Light by default, dark unlocked via `data-theme="dark"` on `<html>`.

`frontend/src/Styles.jsx` (~1500 lines of CSS-in-JS, paired with WealthlyApp) consumes the same vars. The `--color-w-*` Tailwind theme block at the top of index.css aliases the canonical tokens — do not introduce a new naming scheme.

### Key tokens (light, app default)

- `--bg` / `--bg-elev` / `--bg-sunk`: `#F7F6F2` / `#FFFFFF` / `#EFEDE6`
- `--ink` / `--ink-2` / `--ink-3`: `#16150F` / `#56544A` / `#8C8979`
- `--border` / `--border-strong`: `#E4E1D8` / `#D2CEC0`
- `--accent` / `--accent-2` / `--accent-soft`: **`#2540D9`** (cobalt) / `#1A2FA8` / `#E7EBFF`
- `--positive` / `--negative` / `--warning`: `#136D3E` / `#B0392B` / `#8E641A`
- `--d1..d7` dataviz: cobalt, sage, terracotta, mauve, pink, grey, ocre — stable order for charts and bank dots

### Key tokens (dark, used by Landing cover + opt-in user theme)

- `--bg` / `--bg-elev` / `--bg-sunk`: `#0F0E0C` / `#181714` / `#0A0908`
- `--ink` / `--ink-2` / `--ink-3`: `#F1EEE4` / `#A29E91` / `#75716A`
- `--accent`: `#7E92FF` (lifted cobalt for dark)

### Typography

- **Geist** — sans-serif for 95% of the UI (Geist 400/500/600/700)
- **Geist Mono** — IBAN, codes, axes, eyebrow Section labels (`§ 01`)
- **Newsreader** — italic ONLY, for h1/h2 accents (the lead word stays in Geist 500, the noun italicises in Newsreader 400). Never use Newsreader roman.
- Loaded in `frontend/index.html` Google Fonts link
- `font-variant-numeric: tabular-nums` systematic on all monetary values — `.num` / `.amount` / `.w-num` classes

### Brand mark

Single source: `frontend/src/components/Logo.jsx`. Square (cream-on-ink in light, ink-on-cream in dark via MutationObserver on `data-theme`), letter "W" 700, optional wordmark "Wealthly" 500. Used by Landing strip, AuthScreen strip, WealthlyApp desktop sidebar, mobile header, mobile drawer. Favicon + maskable SVGs (`frontend/public/icon*.svg`) match the dark variant for tab/launcher recognition.

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

The `em` inside an h1 inside `.subview-header` (or `.page-header`) automatically picks up Newsreader italic via index.css. Examples already deployed: "Votre *patrimoine.*", "Vos *transactions.*", "Bonjour *Raphaël*".

### Rules

- **No translateY hover** anywhere. Hovers change colour or background, not position. (`:active` jitter on buttons also banned.)
- **Subtle cobalt drop-shadow** on primary CTAs only — `0 4px 14px -4px rgba(126,146,255,.25)` (dark) / `rgba(37,64,217,.25)` (light). Borders + bg shifts elsewhere.
- **Sharper radii** — 4 / 6 / 8 / 12 / 16. No 20 / 24.
- **Single accent**: cobalt for CTAs / data principale / interactive links. Sage for positive, terracotta for negative, ocre for warning. Use them sparingly.
- **Landing is dark-only by force**. `Landing.jsx` forces `data-theme="dark"` on mount and restores on unmount.
- **Drop chauvinism**: no "Hébergé en France" / "Fait en France" / "Disponible en France" on the landing — user finds it ridiculous.
- **PDF export** (`pdfReport.js`) palette mirrors light mode papier chaud — see `C` table at the top of the file.

---

## Auth flow

- Register → JWT → stored in `localStorage` as `wealthly:token`.
- Token expires after 7 days.
- `App.jsx` checks the token on mount via `auth.me()`. If invalid → AuthScreen.
- **Reset token URL handling**: if `?reset_token=` is in the URL, App.jsx forces AuthScreen even if logged in. AuthScreen reads it, switches to `reset` mode, scrubs it from the URL.
- **Demo mode**: localStorage flag `wealthly:demo` → App.jsx renders WealthlyApp in demo mode, bypassing all auth. `api.js` short-circuits all API calls in demo mode (GET returns null, mutations throw a "Mode démo" error).

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
| "reprends le ROADMAP" | Read this file + `ROADMAP.md`, summarize where we left off, ask which item to work on |
| "j'ai des commentaires sur X" | Listen first, gather all the points, propose grouped commits, then execute |
| "pousse tout" | `git status`, commit anything pending, `git push origin main` |
| Pastes an API key | **STOP**. Tell them to revoke it, generate a new one, set it on Railway as env var. Never read or commit the leaked one. |

---

## Latest session — 2026-05-08 (later: account roles + transfer detection)

Real-data discovery: after only connecting Revolut (a travel/online-purchase
wallet, not the user's main account), the dashboard showed nonsense
numbers — net worth €17, savings rate −98 %, etc. Cause: every account
contributed equally to income/expense aggregates regardless of how the
user actually uses it. Two-axis fix shipped:

### Account cashflow roles

Five roles with explicit rules, configurable per account in Réglages:
- **principal** — main account, all flows count (default)
- **depenses** — Revolut-style; outflows ARE expenses, inflows are
  transfers from principal and DO NOT count as income
- **epargne** — Livret/PEL/LDDS; balance counts in NW but flows are
  arbitrages, not cashflow
- **investissement** — PEA/CTO/AV; same as epargne for cashflow
- **professionnel** — fully excluded from personal patrimoine + cashflow

Backend: `accounts.role VARCHAR DEFAULT 'principal' NOT NULL` (+ index),
schema/serializer propagation, lightweight ALTER TABLE on startup.
Frontend: `ACCOUNT_ROLES` table + helpers in utils.js
(`accountIncludeInNetWorth`, `accountCountsAsIncome`,
`accountCountsAsExpense`), aggregator integration in
`monthlyEvolution`, `liquidWealth`, `categoryAnalysis`. Settings UI
shows a per-account `<select>` with each role's tooltip.

### Heuristic role suggestion (`suggestAccountRole`)

When a freshly-imported account is still on the default 'principal',
the Settings UI runs a heuristic on its transactions and proposes a
better role inline: salary pattern (≥2 inflows ≥1 200€ same day-of-
month) → principal; ≥60% virement-labelled inflows + real outflows →
depenses; round inflows + few outflows → epargne; etc. One-click
"Appliquer" on the suggestion.

### Internal transfer detection (`detectInternalTransfers`)

Pair-matches transactions that look like "I moved money between my own
accounts" so cashflow aggregates ignore them. Pure frontend, recomputes
on every visibleTransactions change. Rules:
1. Same |amount| within tolerance `max(1€, 1% of larger leg)` — covers
   Wise/forex commissions
2. Opposite signs
3. Two distinct accounts
4. Within ±3 days (sliding date window)
5. Greedy earliest-first, best amount-match wins

Returns `Set<txId>` with a `.pairs` property exposing
`{ outTxId, inTxId, fromAccountId, toAccountId, amount, date }` so
the UI can render the actual pairs.

### Manual override (`is_transfer_override`)

Backend column on `transactions`, tri-state: null = defer to
auto-detection, true = force-transfer, false = force-not-transfer.
Frontend exposes `setTransferOverride(txId, value)` from WealthlyApp;
effective `transferIds = auto ∪ {override:true} − {override:false}`.
Override is the source of truth so the user can always correct a bad
auto-classification.

UI in Transactions row: gold `↔ Transfert` badge is clickable (= "no,
not a transfer"); a faint `↔` appears on hover for non-detected rows
(= "force this as a transfer"). Both persist immediately.

### Surfacing in the Dashboard

- Section III — Trésorerie footer lists role-based exclusions in serif
  italic ("Exclus du calcul mensuel : Revolut (depenses)…")
- New section `↔ Mouvements internes` lists pair-matched transfers of
  the current month with direction (Boursorama → Livret A : 500€) +
  count + total in the header. Caps at 6.
- Activity recent: ↔ icon + gold "Transfert" pill, dimmed amount.
- Transactions table: "↔ Virement interne" gold pill replaces the
  category pill for detected transfers (clickable to override category).

Commits chronologiques :
- `1ae9c70` cashflow roles (backend + frontend + Settings UI)
- `410f206` initial transfer detection + UI badges
- `b5333fe` forex tolerance widening + auto-suggest role
- `4050283` manual override (backend column) + Mouvements internes
  panel + Virement interne pill

### Known limits / not-yet-shipped

- No "vue partielle" banner (skipped at the user's request) — the user
  is fine seeing approximate data while connecting more accounts.
- Manual transfer override only flags one leg; the *pair* info comes
  from auto-detection only. Manually flagging a tx as transfer doesn't
  reconstruct a counterpart, so it's excluded from cashflow but doesn't
  appear in the Mouvements internes panel.

---

## Latest session — 2026-05-08 (Méridien design pivot)

Direction visuelle revue avec une référence externe ("Direction B —
Méridien" dans `frontend/public/design-b.html` et `design-d.html`,
mockups standalone HTML conservés au cas où). On part désormais sur :
**relevé Pictet** — eyebrow doré "Relevé · …", titres Source Serif 4
avec accent italique or sur le mot-clé, sections numérotées en
chiffres romains italiques (I —, II —, III —…), dotted dividers
façon papier imprimé, hero number serif avec deltas inline 30j/3M/YTD
en serif italique vert/rouge.

Commits chronologiques :
- `505110b` palette + tokens + Source Serif 4 chargée + Dashboard +
  Landing + AuthScreen passés en Méridien
- `83d4e7e` page-headers Méridien sur toutes les vues (Patrimoine,
  Analyse, Transactions, Réglages, Mensuel, Cashflow, Budgets)
- `df32421` chrome (sidebar brand serif), card-header globalement
  upgradé (gold + dotted underline + meta italique), Onboarding /
  ImportFlow / BankCallback / TaxSimulator / AuthScreen modes secondaires
- `4d90961` **Dashboard rebuild fidèle au PDF B** : title+curve sur la
  même ligne, paragraphe sub auto, règle dorée, total NW band avec 3
  deltas inline, 3 sections I/II/III côte à côte avec règles verticales
  (Allocation / Santé / Trésorerie). Sections IV/V/VI en dessous.

### Backup — ancien Dashboard conservé

L'ancien Dashboard (avant le rebuild Méridien) est sauvegardé tel quel
dans `frontend/src/views/Dashboard.legacy.jsx` (486 lignes). Pour
rollback : remplacer dans `WealthlyApp.jsx` l'import
`from './views/Dashboard.jsx'` par `from './views/Dashboard.legacy.jsx'`
— une ligne, retour immédiat à l'ancien design. Le fichier legacy n'est
pas tree-shaken hors d'un import explicite, donc zéro impact bundle.

### Reste à faire (Phase 3+ optionnelle)

- Sparklines compactes sur les KPI (emprunt direction C)
- Mini-sankey dans Cashflow (emprunt C)
- Annotation auto-détectée sur la courbe NetWorthChart ("drawdown
  estival") en serif italique gold
- Empty states éditoriaux

---

## Last work session — 2026-05-06 (investor-ready push, 3 phases)

**Morning**: full visual refonte (hero overhaul, sidebar desktop, mobile
bottom-nav 6 items, palette refinement, DM Sans/Mono fonts, modale
modernization, sober empty states) + complete WealthlyApp découpe
(6 386 → 1 139 lignes via L1 utils/constants/Styles + L2 all 10 views).

**Afternoon**: backend security baseline (slowapi rate limiting on auth),
Alembic infrastructure with auto-stamp baseline, advanced transaction
filters panel (multi-cat / accs / members / dates / amounts / type),
financial health score widget on Dashboard (0-100 SVG gauge + 5-criteria
breakdown).

**Evening**: unrealized gains (purchase_price/date via Alembic + PV %
display), regulatory caps (PEA/Livret A/LDDS), YoY comparison on Suivi
mensuel, account drawer (right slide-in + cross-view tx filter), Finary
loan view rebuild, i18n FR/EN setup with inline FR · EN button (sidebar +
mobile header — out of Settings), AuthScreen polish (radial vignette,
honest copy, gold border-top), PDF rebuild — full dark theme matching the
app, premium Pictet/EdR-style cover (oversized typo + signature gold
rule + 3-card stat grid + "préparé pour" footer + page mark), per-debt
amortization page with capital chart, Unicode sanitize at the doc.text
seam (kills the `/` and `"` glyphs from `Intl.NumberFormat fr-FR`
narrow-NBSP and U+2212 minus). Hotfixes: WEALTH_SUBVIEWS leftover
post-sed crashing the build, SW cache version bump after broken-build
streak, formatDate import missing in Dashboard (black screen post-login).

Roadmap not yet done: JWT → httpOnly cookies (3.2), 2FA TOTP (3.3),
multi-currency (5.3), tests frontend vitest on taxFr.js (6.2), bank
sync cron (6.3), trademark research on "Wealthly" + Hebrew rebrand
candidates, **PDF screenshots embed** à la Finary annual report
(html2canvas → addImage). See ROADMAP.md.

## Previous session — 2026-05-05

Massive session. Delivered (in order of commits):

1. Tailwind v4 + design tokens setup
2. Dashboard redesign (gold direction abandoned mid-session)
3. Visual propagation across all pages (palette + chrome refinement)
4. Mobile responsive + PWA (manifest, SW, icons)
5. Charges-fixes scroll bug fix + PDF export
6. Tax simulator FR (initial)
7. Custom categorization rules
8. Wealth snapshot history + chart
9. Forgot/reset password flow + Resend
10. Backend pytest + GitHub Actions CI
11. Budget alert badge
12. Onboarding refonte + member palette harmonization
13. Tax simulator overhaul (multi-earner salaries + bonuses + childcare/CESU credits + plafond niches + dropped sharedChildren)
14. Rename Trésorerie → Suivi mensuel
15. Demo mode (seeded household, no signup needed)

User stopped before the découpe of WealthlyApp.jsx — that's the next big chantier.

User reported: forgot-password email didn't arrive in their test. Diagnosed as the Resend free-tier sender restriction; logging improved on the backend so future runs surface the cause clearly in Railway logs.

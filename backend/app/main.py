"""
Wealthly API — main entry point.

Run locally: uvicorn app.main:app --reload --port 8000
Docs available at http://localhost:8000/docs
"""
import logging
import sys
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

# Force logs uvicorn / app vers stdout en INFO. Sinon les exceptions
# non gérées ne sortent pas dans Railway Deploy Logs.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
    force=True,
)

from app.config import settings
from app.database import engine, Base
from app.rate_limit import limiter, rate_limit_handler
from app.routers import auth, members, accounts, transactions, wealth, other, categorize, banking, admin, quotes, fixed_charges, dca, ref_month, payees, totp, planned_events, documents, insights, notifications, reports

logger = logging.getLogger("wealthly")

# Create tables on startup. New tables are picked up automatically; ALTER TABLE
# for new columns on existing tables must be run manually below — SQLAlchemy's
# create_all does not migrate existing schemas.
#
# Resilience (2026-06-25): probe the DB with ONE lightweight connection before
# any schema bootstrap. If it's unreachable (bad creds, Supabase pooler
# circuit-breaker, outage…), log and skip create_all / migrations instead of
# letting an unhandled exception kill the process. A boot crash makes Railway
# restart the container every ~3s, and each restart re-opens dozens of failing
# connections — which keeps the Supabase pooler's auth circuit-breaker tripped
# forever. Booting "DB-less" breaks that loop: the app stays up, stops
# hammering, the breaker resets, and DB errors surface per-request instead of
# being hidden behind a boot crash.
def _db_reachable() -> bool:
    if settings.DATABASE_URL.startswith("sqlite"):
        return True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(
            "[startup] DB unreachable — skipping schema bootstrap; the app will "
            "still boot but DB-backed routes will fail until this clears: %s", e
        )
        return False


_DB_OK = _db_reachable()

if _DB_OK:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error("[startup] create_all failed (non-fatal): %s", e)


def _run_lightweight_migrations() -> None:
    """Add columns / constraints introduced after the initial schema.

    Each statement uses IF [NOT] EXISTS so it's safe to run on every boot.
    Postgres-only for the production target; SQLite (local dev) tolerates
    these statements but will error on the unique constraint — that's fine,
    the except clause swallows it because in dev the DB is recreated often.
    """
    is_pg = engine.dialect.name == "postgresql"

    statements: list[str] = []
    if is_pg:
        statements = [
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual' NOT NULL",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id VARCHAR",
            "CREATE INDEX IF NOT EXISTS ix_transactions_source ON transactions (source)",
            "CREATE INDEX IF NOT EXISTS ix_transactions_external_id ON transactions (external_id)",
            # Unique (account_id, external_id) — only enforced when external_id is not null
            # (Postgres treats NULLs as distinct, so duplicates with NULL stay allowed).
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_account_external_id') THEN "
            "    ALTER TABLE transactions ADD CONSTRAINT uq_account_external_id UNIQUE (account_id, external_id); "
            "  END IF; "
            "END $$;",
            # Liability enrichment for the Finary-style detail view
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS down_payment DOUBLE PRECISION",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS insurance_rate DOUBLE PRECISION",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS application_fees DOUBLE PRECISION",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS ownership_pct DOUBLE PRECISION DEFAULT 100.0",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS duration_months INTEGER",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS start_date DATE",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS linked_asset_id VARCHAR",
            # FK constraint after the column exists
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_liability_linked_asset') THEN "
            "    ALTER TABLE liabilities ADD CONSTRAINT fk_liability_linked_asset "
            "      FOREIGN KEY (linked_asset_id) REFERENCES assets(id) ON DELETE SET NULL; "
            "  END IF; "
            "END $$;",
            # Wealth snapshot breakdown — drives the brut/net/financier toggle
            "ALTER TABLE wealth_snapshots ADD COLUMN IF NOT EXISTS real_estate_value DOUBLE PRECISION",
            "ALTER TABLE wealth_snapshots ADD COLUMN IF NOT EXISTS financial_assets_value DOUBLE PRECISION",
            "ALTER TABLE wealth_snapshots ADD COLUMN IF NOT EXISTS mortgage_debt DOUBLE PRECISION",
            "ALTER TABLE wealth_snapshots ADD COLUMN IF NOT EXISTS other_debt DOUBLE PRECISION",
            # Asset enrichment for the Finary-style immo wizard
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS subtype VARCHAR",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS surface_m2 DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS notary_fees DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS agency_fees DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS works_fees DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS furniture_fees DOUBLE PRECISION",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS construction_year INTEGER",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS ownership_pct DOUBLE PRECISION DEFAULT 100.0",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS address VARCHAR",
            # Account cashflow role — drives income/expense exclusion in the
            # monthly aggregator. Default 'principal' keeps existing accounts
            # behaving exactly as before until the user opts in.
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'principal' NOT NULL",
            "CREATE INDEX IF NOT EXISTS ix_accounts_role ON accounts (role)",
            # Joint household flag + IBAN (for last-4 display)
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_joint BOOLEAN DEFAULT FALSE NOT NULL",
            "CREATE INDEX IF NOT EXISTS ix_accounts_is_joint ON accounts (is_joint)",
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS iban VARCHAR",
            # Manual override on the auto-detected internal-transfer flag
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_transfer_override BOOLEAN",
            # ISO 4217 currency on every monetary entity. Default EUR keeps
            # existing rows behaving exactly as before; new records can pick
            # USD / GBP / CHF and the frontend will live-convert via Frankfurter.
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'EUR' NOT NULL",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'EUR' NOT NULL",
            "ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'EUR' NOT NULL",
            # Live-priced assets: ticker symbol + quantity. When both are set,
            # the frontend will display quantity × live_price (Yahoo Finance)
            # instead of the manually-entered current_value.
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS ticker VARCHAR",
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION",
            "CREATE INDEX IF NOT EXISTS ix_assets_ticker ON assets (ticker)",
            # Positions belonging to a parent envelope (PEA/CTO/AV/crypto).
            # Child rows have parent_asset_id = parent.id and type='stocks'.
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id VARCHAR",
            "CREATE INDEX IF NOT EXISTS ix_assets_parent_asset_id ON assets (parent_asset_id)",
            # Security Phase 1 — ces colonnes sont aussi ajoutées par la
            # migration alembic 0002 mais on les duplique ici en safety net
            # au cas où alembic_version a été stampée avant que 0002 existe
            # (le pivot DB → alembic peut laisser ces colonnes manquantes).
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR NOT NULL DEFAULT ''",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE",
            # auth_events — table créée par 0002, créée ici en filet si la
            # migration ne s'est pas appliquée.
            "CREATE TABLE IF NOT EXISTS auth_events ("
            "  id VARCHAR PRIMARY KEY,"
            "  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,"
            "  email VARCHAR,"
            "  kind VARCHAR NOT NULL,"
            "  success BOOLEAN NOT NULL DEFAULT TRUE,"
            "  ip VARCHAR,"
            "  user_agent TEXT,"
            "  detail TEXT,"
            "  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()"
            ")",
            "CREATE INDEX IF NOT EXISTS ix_auth_events_kind       ON auth_events (kind)",
            "CREATE INDEX IF NOT EXISTS ix_auth_events_email      ON auth_events (email)",
            "CREATE INDEX IF NOT EXISTS ix_auth_events_ip         ON auth_events (ip)",
            "CREATE INDEX IF NOT EXISTS ix_auth_events_created_at ON auth_events (created_at)",
            # bank_connections columns — historically introduced for Enable
            # Banking, kept as-is for the GoCardless integration that replaced
            # it. session_id stores the GoCardless requisition_id now.
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS session_id VARCHAR",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS bank_name VARCHAR NOT NULL DEFAULT ''",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS bank_country VARCHAR DEFAULT 'FR'",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS state VARCHAR",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS accounts_data JSON",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS error_message TEXT",
            "ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
            # FixedCharge kind — 'expense' (default) or 'income'. Lets users
            # plan recurring revenus alongside recurring charges in Suivi mensuel.
            "ALTER TABLE fixed_charges ADD COLUMN IF NOT EXISTS kind VARCHAR NOT NULL DEFAULT 'expense'",
            "CREATE INDEX IF NOT EXISTS ix_fixed_charges_kind ON fixed_charges (kind)",
            # Account source + external_id — lets the GoCardless sync re-find
            # the same Wealthly account on subsequent runs (avoid duplicates).
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'manual'",
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS external_id VARCHAR",
            "CREATE INDEX IF NOT EXISTS ix_accounts_source ON accounts (source)",
            "CREATE INDEX IF NOT EXISTS ix_accounts_external_id ON accounts (external_id)",
            # wealth_item_uuid — Option A++ unification preparation (2026-05-13)
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wealth_item_uuid VARCHAR",
            "ALTER TABLE assets   ADD COLUMN IF NOT EXISTS wealth_item_uuid VARCHAR",
            # DCA plans — per-month execution map. Lets the user mark months
            # as paid/skipped vs the simulated default. Missing keys = paid.
            "ALTER TABLE dca_plans ADD COLUMN IF NOT EXISTS executions JSON DEFAULT '{}'::json NOT NULL",
            # Mois type — JSON budget template stored per user. See
            # docs/superpowers/specs/2026-05-14-budget-mensuel-refonte-design.md.
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_month JSON",
            # 2FA TOTP (C19 2026-05-18) — secret base32 + enabled flag.
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE",
            # Révocation de session (token_version) — 2026-06-08
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0",
            # TOTP replay prevention (sec-audit 2026-05-19) — timestamp of last
            # accepted code; reject any code from the same 30s window.
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_otp_at TIMESTAMP WITHOUT TIME ZONE",
            # Solde officiel GoCardless rafraichi a chaque sync (2026-05-19) —
            # corrige le bug "solde Revolut affiche faux" en evitant la
            # derive initial_balance + somme(tx) vs vrai solde banque.
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_known_balance DOUBLE PRECISION",
            "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_balance_at TIMESTAMP WITHOUT TIME ZONE",
            # ISIN code (ISO 6166) for stock / ETF positions — stored alongside
            # ticker so both are available for display and future lookups.
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS isin VARCHAR",
            # Two-level category taxonomy (2026-05-15) — parent_slug groups
            # sub-categories under a top-level category. NULL = top-level.
            "ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_slug VARCHAR",
            "CREATE INDEX IF NOT EXISTS ix_categories_parent_slug ON categories (parent_slug)",
            # Transverse tags on transactions (free-form labels: #vacances, #pro…).
            # JSON array — empty list by default. Lets users tag a tx across
            # multiple dimensions without exploding the category taxonomy.
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tags JSON NOT NULL DEFAULT '[]'::json",
            # ── Catégorisation v2 (2026-05-16) — Payees + Category Learning
            # Nouvelles tables (payees, payee_match_rules) déjà créées par
            # create_all ci-dessus. Ici on étend les tables existantes.
            "ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS created_by VARCHAR DEFAULT 'user' NOT NULL",
            "ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS rule_type VARCHAR DEFAULT 'category' NOT NULL",
            "ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS payee_id VARCHAR",
            "ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100 NOT NULL",
            "ALTER TABLE categorisation_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rule_payee') THEN "
            "    ALTER TABLE categorisation_rules ADD CONSTRAINT fk_rule_payee "
            "      FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE CASCADE; "
            "  END IF; "
            "END $$;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payee_id VARCHAR",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cat_source VARCHAR",
            "CREATE INDEX IF NOT EXISTS ix_transactions_payee_id ON transactions (payee_id)",
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tx_payee') THEN "
            "    ALTER TABLE transactions ADD CONSTRAINT fk_tx_payee "
            "      FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE SET NULL; "
            "  END IF; "
            "END $$;",
            # Toggle Category Learning auto par foyer (2026-05-16)
            "ALTER TABLE households ADD COLUMN IF NOT EXISTS auto_learning_enabled BOOLEAN DEFAULT TRUE NOT NULL",
            # Opt-in email bilan mensuel (2026-06-06)
            "ALTER TABLE households ADD COLUMN IF NOT EXISTS monthly_report_enabled BOOLEAN DEFAULT FALSE NOT NULL",
            # Plan du foyer (drift de schéma : présent dans l'ORM mais absent en
            # base prod → l'INSERT à l'inscription échouait. 2026-06-08)
            "ALTER TABLE households ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'solo' NOT NULL",
            # Suppression mortgage_interest (2026-05-18) — remplacé par loan_mortgage.
            # Reclasse les transactions existantes + les règles de catégorisation.
            "UPDATE transactions SET category_slug = 'loan_mortgage' WHERE category_slug = 'mortgage_interest'",
            "UPDATE categorisation_rules SET category_slug = 'loan_mortgage' WHERE category_slug = 'mortgage_interest'",
        ]

    # Promote ADMIN_EMAILS → is_admin = TRUE. Idempotent, runs every boot
    # but only touches rows where is_admin is currently false (safe).
    if is_pg and settings.ADMIN_EMAILS:
        for email in settings.ADMIN_EMAILS:
            try:
                with engine.begin() as conn:
                    conn.execute(
                        text("UPDATE users SET is_admin = TRUE WHERE LOWER(email) = :email AND is_admin = FALSE"),
                        {"email": email.lower()},
                    )
                    logger.info("[admin-bootstrap] promoted %s to admin", email)
            except Exception as e:
                logger.warning("[admin-bootstrap] failed for %s: %s", email, e)
    # Each statement runs in its own transaction so a failed DDL/DML
    # doesn't leave the connection in an aborted-transaction state and
    # block every subsequent statement (and app queries) in the same block.
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as e:
            logger.warning("[migrate] skipped statement (%s): %s", stmt[:80], e)


if _DB_OK:
    _run_lightweight_migrations()


def _alembic_sync() -> None:
    """Bring the alembic_version table into agreement with the live schema.

    Two cases the startup hook handles automatically so deploys are safe:
    1. Existing prod DB (Supabase) with tables but no alembic_version row →
       stamp 'head'. Treats the current schema as the alembic baseline so
       future migrations can run cleanly.
    2. Any DB already at some revision → upgrade head, applying any new
       migrations shipped in this deploy.

    Non-fatal: if alembic isn't installed or alembic.ini is missing, we log
    and continue; create_all() + the lightweight migrations above already
    keep the DB usable.
    """
    try:
        from alembic.config import Config as AlembicConfig
        from alembic import command as alembic_command
    except ImportError:
        logger.warning("[alembic] alembic package not installed — skipping sync")
        return

    import os
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg_path = os.path.join(project_root, "alembic.ini")
    if not os.path.exists(cfg_path):
        logger.warning("[alembic] %s missing — skipping sync", cfg_path)
        return

    cfg = AlembicConfig(cfg_path)
    cfg.set_main_option("script_location", os.path.join(project_root, "alembic"))

    try:
        with engine.connect() as conn:
            has_version_table = conn.execute(text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'alembic_version'"
            )).first() is not None
            # Révision COURANTE réellement enregistrée (pas juste l'existence
            # de la table). C'est le point clé du fix perf 2026-06-30 :
            current_rev = None
            if has_version_table:
                row = conn.execute(text(
                    "SELECT version_num FROM alembic_version LIMIT 1"
                )).first()
                current_rev = row[0] if row else None

        if current_rev is None:
            # DB fraîche OU table alembic_version présente mais VIDE. Dans les
            # deux cas le schéma est déjà entièrement construit au-dessus par
            # create_all() + _run_lightweight_migrations(). On STAMPE head
            # (instantané) au lieu de rejouer toute la chaîne 0001→0015 à CHAQUE
            # boot — ce que faisait la branche `upgrade` quand la table existait
            # mais était vide (logs "Running upgrade -> 0001_baseline" à chaque
            # démarrage → redéploiements lents signalés par l'user).
            logger.info("[alembic] pas de révision courante — stamp head (schéma déjà via create_all)")
            alembic_command.stamp(cfg, "head")
        else:
            # Révision existante : on applique uniquement les migrations en
            # attente (no-op si déjà à head).
            alembic_command.upgrade(cfg, "head")
    except Exception as e:
        logger.warning("[alembic] sync failed (non-fatal): %s", e)


if _DB_OK:
    _alembic_sync()

# Surface GoCardless config status at startup so Railway logs make it
# obvious whether the env vars are loaded in the container.
if settings.GOCARDLESS_SECRET_ID and settings.GOCARDLESS_SECRET_KEY:
    logger.warning("[gocardless] configured (secret_id=%s…)", settings.GOCARDLESS_SECRET_ID[:8])
else:
    logger.warning(
        "[gocardless] NOT configured — set GOCARDLESS_SECRET_ID + GOCARDLESS_SECRET_KEY (currently id=%r key=%r)",
        bool(settings.GOCARDLESS_SECRET_ID),
        bool(settings.GOCARDLESS_SECRET_KEY),
    )

app = FastAPI(
    title=settings.APP_NAME,
    version="2.1.0",
    description="Self-hosted family finance tracker — backend API",
)

# Per-IP rate limiting (auth routes only — see app.rate_limit + routers.auth)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# CORS — restreint aux méthodes/headers réellement utilisés (audit sécu F3
# 2026-05-19). allow_methods="*"+credentials est techniquement refusé par
# certains navigateurs ; on liste explicitement.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "X-Cron-Secret"],
    expose_headers=["X-CSRF-Token"],
)


# Security headers — applied to every response
from app.security import apply_security_headers


@app.middleware("http")
async def security_headers_mw(request, call_next):
    response = await call_next(request)
    apply_security_headers(response)
    return response

# Pydantic validation error handler — sanitize internal field structure from
# responses (sec-audit 2026-05-19). Default FastAPI 422 response exposes
# model internals like {"loc":["body","password"],"type":"string_too_short"}.
# We replace it with a human-readable flat message list.
@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError):
    messages = []
    for err in exc.errors():
        loc = " → ".join(str(l) for l in err.get("loc", []) if l not in ("body",))
        msg = err.get("msg", "Valeur invalide")
        if loc and loc not in ("",):
            messages.append(f"{loc} : {msg}")
        else:
            messages.append(msg)
    detail = " | ".join(messages) if messages else "Paramètres invalides."
    return JSONResponse(status_code=422, content={"detail": detail})


# Global exception handler — surface la stack trace dans les logs Railway
# mais NE l'expose PAS au client (audit sécu C2 2026-05-19). Le client
# reçoit un message générique 500. La stack reste loggable côté serveur.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    logger.error("[unhandled] %s %s\n%s", request.method, request.url.path, tb)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erreur interne du serveur."},
    )


# Health check (used by Docker healthcheck)
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "2.0.0"}

# Mount all routers
app.include_router(auth.router)
app.include_router(members.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(wealth.router)
app.include_router(other.router)
app.include_router(categorize.router)
app.include_router(reports.router)
app.include_router(banking.router)
app.include_router(admin.router)
app.include_router(quotes.router)
app.include_router(fixed_charges.router)
app.include_router(dca.router)
app.include_router(ref_month.router)
app.include_router(payees.router)
app.include_router(totp.router)
app.include_router(planned_events.router)
app.include_router(documents.router)
app.include_router(insights.router)
app.include_router(notifications.router)

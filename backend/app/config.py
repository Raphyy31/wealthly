"""
Centralised configuration loaded from environment variables.
All sensitive values come from .env (never committed to Git).

Sécurité (audit 2026-05-19) : SECRET_KEY et DATABASE_URL n'ont plus de
fallback en dur. Si l'env var manque en production, le backend refuse
de démarrer plutôt que d'utiliser un secret public.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present (for local dev outside Docker)
ENV_FILE = Path(__file__).parent.parent / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


# Mode dev local autorise les fallbacks (pratique dev sans Postgres).
# En prod (Railway), DEBUG=false → fallbacks bannis pour les secrets critiques.
_DEBUG = os.getenv("DEBUG", "false").lower() == "true"


def _require_env(var_name: str, dev_fallback: str | None = None) -> str:
    """Lit une env var critique. En dev (DEBUG=true) on autorise un fallback,
    sinon on raise pour empêcher le démarrage avec un secret public."""
    value = os.getenv(var_name)
    if value:
        return value
    if _DEBUG and dev_fallback is not None:
        # Avertir clairement même en dev (visible dans les logs Vite/uvicorn)
        sys.stderr.write(
            f"[WARN] {var_name} non défini — fallback dev utilisé. "
            f"NE JAMAIS déployer en production sans définir cette variable.\n"
        )
        return dev_fallback
    raise RuntimeError(
        f"[FATAL] {var_name} non défini. "
        f"Cette variable d'environnement est OBLIGATOIRE en production. "
        f"Set DEBUG=true pour autoriser un fallback en dev local."
    )


class Settings:
    # Database — DATABASE_URL obligatoire en prod (sinon fallback dev avec un
    # password explicitement bidon). On laisse Postgres refuser la connexion
    # plutôt que de tomber sur un défaut sécurisable.
    DATABASE_URL: str = _require_env(
        "DATABASE_URL",
        dev_fallback="postgresql://wealthly:dev_only_change_me@localhost:5432/wealthly_dev",
    )

    # JWT auth — SECRET_KEY obligatoire. Ancien fallback "CHANGE_ME_IN_PRODUCTION_PLEASE"
    # était CRITIQUE (public dans le repo) — viré.
    SECRET_KEY: str = _require_env(
        "SECRET_KEY",
        # Fallback dev généré aléatoirement à chaque process — invalide les tokens
        # entre redémarrages mais empêche tout secret public.
        dev_fallback=os.urandom(32).hex(),
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

    # CORS — comma-separated list of allowed origins (exact match)
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173"
    ).split(",")

    # CORS regex — matches all Vercel deployments by default
    # (each Vercel deploy gets a new hash-prefix URL, so a regex is needed
    # alongside the exact list).
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https://wealthly(-[a-z0-9-]+)?\.vercel\.app$"
    )

    # Anthropic (optional — enables AI categorization)
    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")

    # GoCardless Bank Account Data (open banking sync, ex-Nordigen)
    # Get credentials at: https://bankaccountdata.gocardless.com/user/secrets/
    # Empty fallback acceptable : API GoCardless refusera, donc défense
    # naturelle si pas configuré.
    GOCARDLESS_SECRET_ID: str = os.getenv("GOCARDLESS_SECRET_ID", "")
    GOCARDLESS_SECRET_KEY: str = os.getenv("GOCARDLESS_SECRET_KEY", "")
    GOCARDLESS_REDIRECT_URI: str = os.getenv(
        "GOCARDLESS_REDIRECT_URI",
        "https://wealthly-six.vercel.app"
    )
    GOCARDLESS_API_BASE: str = "https://bankaccountdata.gocardless.com/api/v2"

    # Cron auth — partagé entre les jobs Railway (cron nightly sync, etc.)
    # et le backend. Si vide en prod, les endpoints /cron/* refusent toutes
    # les requêtes (jamais d'endpoint sans auth ouvert).
    CRON_SECRET: str = os.getenv("CRON_SECRET", "")

    # App
    APP_NAME: str = "Wealthly API"
    DEBUG: bool = _DEBUG


settings = Settings()

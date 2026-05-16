"""
Centralised configuration loaded from environment variables.
All sensitive values come from .env (never committed to Git).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present (for local dev outside Docker)
ENV_FILE = Path(__file__).parent.parent / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


class Settings:
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://wealthly:wealthly@db:5432/wealthly"
    )

    # JWT auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE_ME_IN_PRODUCTION_PLEASE")
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
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"


settings = Settings()

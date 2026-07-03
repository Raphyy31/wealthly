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
        dev_fallback="postgresql://yotori:dev_only_change_me@localhost:5432/yotori_dev",
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

    # Nombre de proxies de confiance devant l'app (Railway = 1). Le vrai IP
    # client est juste avant ces N derniers hops du X-Forwarded-For ; tout ce
    # que le client peut injecter est à gauche → non spoofable si N est correct.
    TRUSTED_PROXY_HOPS: int = int(os.getenv("TRUSTED_PROXY_HOPS", "1"))

    # CORS — comma-separated list of allowed origins (exact match)
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173"
    ).split(",")

    # CORS regex — matches the specific Vercel project preview URLs.
    # Scoped to the project slugs to prevent other Vercel accounts from
    # registering "wealthly-attack.vercel.app" and abusing CORS (Vercel garantit
    # l'unicite du slug projet par owner).
    # Pattern : slug + 0 a 3 segments alphanumeriques dash-separes :
    #   - wealthly-six.vercel.app                      (prod actuelle, slug historique)
    #   - yotori.vercel.app / yotori-finance.vercel.app (rebranding Yotori Finance)
    #   - wealthly-git-main-raphyy31.vercel.app        (preview branch)
    # sec-audit 2026-05-19 + fix 2026-05-19 (la regex initiale exigeait
    # exactement 3 segments et rejetait l'URL prod wealthly-six).
    # Rebranding 2026-07 : « yotori » ajouté SANS retirer « wealthly » — le
    # projet Vercel actuel garde son slug tant qu'il n'est pas renommé.
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https://(wealthly|yotori(-finance)?)(-[a-z0-9]+){0,3}\.vercel\.app$"
    )

    # Anthropic (optional — enables AI categorization + coach)
    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
    # OpenAI (optional — alternative provider for TRANSACTION CATEGORIZATION
    # only ; le Coach reste sur Anthropic). BYOK : créer la clé sur
    # https://platform.openai.com/api-keys et créditer le compte.
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    # Sélection du provider de catégorisation :
    #   "auto"      → Anthropic si sa clé est posée, sinon OpenAI (défaut)
    #   "anthropic" → force Claude (échoue proprement si clé absente)
    #   "openai"    → force OpenAI
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "auto").strip().lower()
    # Modèles par usage (override env possible sans toucher au code).
    # Coach = Sonnet (analyses plus fines), catégorisation = Haiku (pas cher).
    AI_MODEL_COACH: str = os.getenv("AI_MODEL_COACH", "claude-sonnet-4-5-20250929")
    AI_MODEL_CATEGORIZE: str = os.getenv("AI_MODEL_CATEGORIZE", "claude-haiku-4-5-20251001")
    # Équivalents OpenAI (petits modèles économiques par défaut). Le coach
    # peut monter en gamme via env (ex. gpt-4o) sans toucher au code.
    AI_MODEL_CATEGORIZE_OPENAI: str = os.getenv("AI_MODEL_CATEGORIZE_OPENAI", "gpt-4o-mini")
    AI_MODEL_COACH_OPENAI: str = os.getenv("AI_MODEL_COACH_OPENAI", "gpt-4o-mini")
    # Plafond mensuel d'appels IA par foyer (filet anti token-burn). Au-delà →
    # fallback déterministe. Le cache du Coach (24h) limite déjà fortement.
    AI_MONTHLY_CAP: int = int(os.getenv("AI_MONTHLY_CAP", "300"))
    AI_COACH_CACHE_HOURS: int = int(os.getenv("AI_COACH_CACHE_HOURS", "24"))

    # Email service (Resend) — utilisé par forgot-password + admin reset.
    # Empty fallback → email_service.py retourne False silencieusement.
    RESEND_API_KEY: str | None = os.getenv("RESEND_API_KEY")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "Yotori Finance <onboarding@resend.dev>")
    # URL frontend utilisée dans les emails (lien reset password etc.)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://wealthly-six.vercel.app")

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
    # Durées maximales pour le consentement bancaire (90 jours max par défaut DSP2)
    GOCARDLESS_HISTORICAL_DAYS: int = int(os.getenv("GOCARDLESS_HISTORICAL_DAYS", "90"))
    GOCARDLESS_ACCESS_VALID_DAYS: int = int(os.getenv("GOCARDLESS_ACCESS_VALID_DAYS", "90"))

    # Cron auth — partagé entre les jobs Railway (cron nightly sync, etc.)
    # et le backend. Si vide en prod, les endpoints /cron/* refusent toutes
    # les requêtes (jamais d'endpoint sans auth ouvert).
    CRON_SECRET: str = os.getenv("CRON_SECRET", "")

    # Google OAuth — client_id only (not a secret; safe to expose in frontend).
    # Set GOOGLE_CLIENT_ID on Railway to enable "Se connecter avec Google".
    # If absent, the /auth/google endpoint returns 501.
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID")

    # Platform admin bootstrap — comma-separated list of emails to promote
    # as platform admins on first boot. Idempotent (UPDATE … WHERE NOT is_admin).
    # Set ADMIN_EMAILS on Railway: raphael.darmon1@gmail.com
    ADMIN_EMAILS: list[str] = [
        e.strip().lower()
        for e in os.getenv("ADMIN_EMAILS", "").split(",")
        if e.strip()
    ]

    # App
    APP_NAME: str = "Yotori Finance API"
    DEBUG: bool = _DEBUG


settings = Settings()

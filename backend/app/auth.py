"""
Authentication: password hashing (bcrypt) + JWT generation/validation.

Token transport — Wealthly uses an HttpOnly, Secure, SameSite=None cookie
(`trove_session`, name kept from the Trove rebrand era) so the token is
unreachable from JavaScript and resistant to XSS exfiltration. The
production frontend uses cookies exclusively. The `Authorization: Bearer`
header is still accepted at the API surface (defense-in-depth — used by
the pytest suite and any future service-to-service callers); the
frontend never sends it.

Flow:
1. Register / Login / Reset-password → backend `Set-Cookie: trove_session`.
2. Authenticated requests → the browser auto-sends the cookie.
3. Logout → `/auth/logout` clears the cookie.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt as _bcrypt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False so we can fall back to the cookie when no Bearer header
# is sent — without OAuth2PasswordBearer raising 401 first.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

COOKIE_NAME = "trove_session"


def hash_password(password: str) -> str:
    """Hash a plain password using bcrypt (via la lib `bcrypt` directe).

    On n'utilise plus passlib ici : la combo passlib 1.7.4 + bcrypt 4.x casse
    la vérification de certains hashes — notamment les `$2a$` générés par
    pgcrypto (`crypt(..., gen_salt('bf'))`), alors que `bcrypt.checkpw` gère
    `$2a$`/`$2b$`/`$2y$` de façon uniforme. bcrypt lève un ValueError au-delà
    de 72 octets → on tronque explicitement (passlib tronquait silencieusement).
    """
    pw = password.encode("utf-8")[:72]
    return _bcrypt.hashpw(pw, _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against its bcrypt hash (bcrypt lib directe).

    Compatible avec les hashes existants (`$2b$` posés par passlib) ET les
    `$2a$` de pgcrypto. Tout hash mal formé renvoie False au lieu de lever.
    """
    try:
        return _bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str, household_id: str, token_version: int = 0) -> str:
    """Create a signed JWT containing user_id, household_id and token_version.
    `tv` permet de révoquer les anciens tokens après un changement de mot de
    passe / désactivation 2FA (cf. get_current_user)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "hh": household_id,
        "tv": int(token_version or 0),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises 401 on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_access_token(token: str) -> Optional[dict]:
    """Like decode_token but returns None on failure instead of raising.
    Used by the audit-log resolver in /auth/logout."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ── Cookie helpers ──────────────────────────────────────────────────────────

def set_auth_cookie(response: Response, token: str) -> None:
    """Set the auth cookie. SameSite=None + Secure because the API and
    the frontend live on different origins (Vercel ↔ Railway), which means
    the cookie has to be cross-site-eligible. HttpOnly keeps it unreachable
    from JS, so XSS cannot exfiltrate the session."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the auth cookie using delete_cookie (sets Max-Age=0 + expires past).
    Attributes must mirror set_auth_cookie exactly so the browser matches it."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        samesite="none",
        secure=True,
        httponly=True,
    )


def get_token_from_request(request: Request) -> Optional[str]:
    """Read the auth token from cookie first, then fall back to the
    Authorization: Bearer header (kept for tests + service-to-service)."""
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(None, 1)[1].strip()
    return None


# ── Current-user dependency ─────────────────────────────────────────────────

def get_current_user(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: returns the User for the current request, or 401.

    Token resolution order:
      1. trove_session HttpOnly cookie (preferred, XSS-safe, used by frontend)
      2. Authorization: Bearer header (tests + service-to-service)
    """
    token = request.cookies.get(COOKIE_NAME) or bearer_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Révocation de session : si le token_version du JWT ne correspond plus à
    # celui du user (mot de passe changé/réinitialisé, 2FA désactivée), le token
    # est obsolète → 401. Les tokens émis avant l'ajout du claim ont tv=0.
    if int(payload.get("tv", 0) or 0) != int(getattr(user, "token_version", 0) or 0):
        raise HTTPException(status_code=401, detail="Session révoquée, reconnectez-vous")

    # ── RLS context (defense-in-depth) ──────────────────────────────────────
    # Toutes les requêtes ORM qui s'exécutent ensuite dans le SAME transaction
    # block ne verront que les lignes du foyer du user. set_config(..., true)
    # = équivalent SET LOCAL : la variable est reset à la fin de la
    # transaction, donc pas de fuite entre requêtes / users sur le même pool.
    # Sur SQLite (tests), set_config n'existe pas → on swallow l'erreur.
    if db.bind and db.bind.dialect.name == 'postgresql':
        from sqlalchemy import text
        db.execute(
            text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": user.household_id},
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency for /admin/* endpoints. 403 if the caller isn't admin."""
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Accès admin requis")
    return user

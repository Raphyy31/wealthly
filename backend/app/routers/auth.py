"""
Authentication endpoints: register, login, logout, password reset.

Security guarantees added in this module:
  - Every login / register / reset attempt is recorded in `auth_events`
    (success or failure, with IP + user-agent) so /admin can review.
  - Brute-force lockout: 5 failed logins on the same IP **or** the same
    email within 15 minutes triggers a 30-minute block. Detection lives
    in `app.security.is_locked_out`.
  - Password complexity: ≥10 chars, letters + digits, not in HIBP.
  - Auth cookie: on successful login/register/reset we set an HttpOnly +
    Secure + SameSite=None cookie carrying the JWT. The `access_token`
    JSON field is still returned in the response body for backward
    compatibility with the `Token` schema but the frontend ignores it —
    cookie is the only transport.
"""
import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Household, Category, PasswordResetToken
from app.rate_limit import limiter
from app.schemas import (
    UserCreate, UserLogin, Token, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, MessageOut,
)
from app.auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    set_auth_cookie, clear_auth_cookie,
)
from app.defaults import DEFAULT_CATEGORIES
from app.config import settings
from app.email_service import send_password_reset_email
from app.security import record_auth_event, is_locked_out, validate_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Token settings
RESET_TOKEN_TTL_MINUTES = 60


def _hash_reset_token(token: str) -> str:
    """SHA-256 of the raw token, hex-encoded. Stored in DB; the raw token
    only ever travels in the email link, never in the database."""
    return hashlib.sha256(token.encode()).hexdigest()


def _client_ip(request: Request) -> str | None:
    """Extract the real client IP.

    Railway's proxy appends the client IP to X-Forwarded-For as the LAST
    entry before its own proxy IP. We use the second-to-last entry when
    there are multiple hops, or the first entry when there is only one.

    Using xff[0] (the first entry) is spoofable: an attacker can send
    X-Forwarded-For: fake_ip, and the proxy will prepend it.
    Using xff[-1] is safer but gives the proxy's own IP when behind Railway.
    Using xff[-2] (penultimate) gives the true client IP behind Railway.
    Fallback to request.client.host (direct connection IP) if XFF is absent.

    sec-audit 2026-05-19: changed from [0] (spoofable) to [-2] or [-1].
    """
    import ipaddress
    direct = request.client.host if request.client else None
    candidate = None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        # On fait confiance aux N derniers hops (proxies Railway). Le vrai client
        # est juste avant : index len-1-N. Ce qu'un attaquant injecte est à
        # gauche de cette position → non spoofable si TRUSTED_PROXY_HOPS est juste.
        n = max(0, int(getattr(settings, "TRUSTED_PROXY_HOPS", 1) or 1))
        idx = len(hops) - 1 - n
        if 0 <= idx < len(hops):
            candidate = hops[idx]
        elif hops:
            candidate = hops[-1]
    # Valide : si ce n'est pas une IP plausible (injection), on retombe sur l'IP
    # de la connexion directe (le proxy) — non spoofable.
    for val in (candidate, direct):
        if not val:
            continue
        try:
            ipaddress.ip_address(val)
            return val
        except ValueError:
            continue
    return direct


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, response: Response, payload: UserCreate, db: Session = Depends(get_db)):
    """Create a new household with its first admin user. Seeds default categories."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        # Audit sécu H5 (2026-05-19) : message générique pour éviter l'énumération
        # d'emails. L'erreur réelle reste tracée en audit log côté serveur.
        record_auth_event(db, kind="register_failure", success=False, request=request,
                          email=payload.email, detail="email_already_registered")
        raise HTTPException(status_code=400, detail="Inscription impossible avec ces informations. Si vous avez déjà un compte, essayez de vous connecter ou de réinitialiser votre mot de passe.")

    ok, err = validate_password(payload.password)
    if not ok:
        record_auth_event(db, kind="register_failure", success=False, request=request,
                          email=payload.email, detail=err or "weak_password")
        raise HTTPException(status_code=400, detail=err)

    household = Household(name=payload.household_name or "Mon foyer")
    db.add(household)
    db.flush()  # household INSERT

    # RLS : la table `categories` est ENABLE+FORCE row-level security avec une
    # policy WITH CHECK sur current_setting('app.current_household_id'). À
    # l'inscription, aucun utilisateur n'est encore authentifié → on pose le
    # contexte sur le foyer qu'on vient de créer (transaction-scoped) avant
    # d'insérer les catégories par défaut. No-op sur SQLite (tests).
    try:
        from sqlalchemy import text
        db.execute(
            text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(household.id)},
        )
    except Exception:
        pass

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        is_admin=False,  # platform admin must be set manually via seed_admins script
        household_id=household.id,
    )
    db.add(user)

    for cat in DEFAULT_CATEGORIES:
        db.add(Category(household_id=household.id, **cat))

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, household.id)
    set_auth_cookie(response, token)
    record_auth_event(db, kind="register_success", success=True, request=request,
                      user_id=user.id, email=user.email)
    return Token(access_token=token)


@router.post("/login", response_model=Token)
@limiter.limit("30/minute")
def login(request: Request, response: Response, payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate and return a JWT (also sets an HttpOnly cookie)."""
    ip = _client_ip(request)

    if is_locked_out(db, email=payload.email, ip=ip):
        record_auth_event(db, kind="login_failure", success=False, request=request,
                          email=payload.email, detail="locked_out")
        raise HTTPException(
            status_code=429,
            detail="Trop de tentatives échouées. Réessayez dans 30 minutes ou réinitialisez votre mot de passe.",
        )

    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        record_auth_event(db, kind="login_failure", success=False, request=request,
                          email=payload.email,
                          detail="bad_credentials" if user else "unknown_email")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    # 2FA TOTP (C19 2026-05-18) — si activé, exiger code 6 chiffres step 2.
    if user.totp_enabled:
        if not payload.totp_code:
            # Pas de code fourni → frontend doit afficher écran step 2
            raise HTTPException(status_code=401, detail="totp_required")
        try:
            import pyotp, math, time
            from datetime import datetime, timezone
            totp = pyotp.TOTP(user.totp_secret)
            # valid_window=1 → tolérance ±30s (clock skew normal)
            if not totp.verify(payload.totp_code, valid_window=1):
                record_auth_event(db, kind="login_failure", success=False, request=request,
                                  email=payload.email, detail="bad_totp")
                raise HTTPException(status_code=401, detail="Code 2FA incorrect")
            # Anti-replay: reject if this 30s window was already used
            TOTP_STEP = 30
            if user.totp_last_otp_at is not None:
                last = user.totp_last_otp_at
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                window_start = math.floor(time.time() / TOTP_STEP) * TOTP_STEP
                if datetime.fromtimestamp(window_start, tz=timezone.utc) <= last:
                    record_auth_event(db, kind="login_failure", success=False, request=request,
                                      email=payload.email, detail="totp_replay")
                    raise HTTPException(status_code=401, detail="Code 2FA déjà utilisé. Attendez le prochain code.")
            # Mark code as used
            user.totp_last_otp_at = datetime.now(timezone.utc)
            db.commit()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Erreur vérification 2FA")

    token = create_access_token(user.id, user.household_id, user.token_version)
    set_auth_cookie(response, token)
    record_auth_event(db, kind="login_success", success=True, request=request,
                      user_id=user.id, email=user.email)
    return Token(access_token=token)


@router.post("/logout", response_model=MessageOut)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Clear the auth cookie. We don't blacklist the JWT itself (stateless
    by design) but the cookie disappears so subsequent requests fail.
    Audit log records the explicit logout."""
    clear_auth_cookie(response)
    # Best-effort: log who logged out if we can resolve them.
    try:
        from app.auth import get_token_from_request, decode_access_token
        token = get_token_from_request(request)
        user_id = None
        email = None
        if token:
            payload = decode_access_token(token)
            user_id = payload.get("sub") if payload else None
            if user_id:
                u = db.query(User).filter(User.id == user_id).first()
                email = u.email if u else None
        record_auth_event(db, kind="logout", success=True, request=request,
                          user_id=user_id, email=email)
    except Exception:
        pass
    return MessageOut(message="Déconnecté.")


@router.get("/me", response_model=UserOut)
@limiter.limit("60/minute")
def me(request: Request, current_user: User = Depends(get_current_user)):
    """Return the current authenticated user.
    Rate-limited to prevent probing / credential stuffing via this endpoint.
    60/min is generous for legitimate use (app polls on focus) but blocks bots.
    """
    return current_user


@router.post("/forgot-password", response_model=MessageOut)
@limiter.limit("15/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a single-use reset token and email it to the user.

    Always returns a generic success message — even if the email is unknown
    — to avoid leaking which addresses are registered.
    """
    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()
    if user:
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update({"used_at": datetime.utcnow()})

        raw_token = secrets.token_urlsafe(32)
        record = PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        )
        db.add(record)
        db.commit()

        link = f"{settings.FRONTEND_URL.rstrip('/')}/?reset_token={raw_token}"
        send_password_reset_email(user.email, user.full_name, link)

    record_auth_event(db, kind="password_reset_request", success=True, request=request,
                      email=payload.email,
                      user_id=user.id if user else None)
    return MessageOut(message="Si cet email existe, un lien de réinitialisation a été envoyé.")


@router.post("/reset-password", response_model=Token)
def reset_password(request: Request, response: Response, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a reset token and replace the user's password."""
    ok, err = validate_password(payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    token_hash = _hash_reset_token(payload.token)
    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not record:
        record_auth_event(db, kind="password_reset_failure", success=False, request=request,
                          detail="invalid_or_expired_token")
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré. Demandez un nouveau lien.")

    user = db.query(User).filter(User.id == record.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur introuvable.")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1  # révoque les anciens tokens
    record.used_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.household_id, user.token_version)
    set_auth_cookie(response, token)
    record_auth_event(db, kind="password_reset_success", success=True, request=request,
                      user_id=user.id, email=user.email)
    return Token(access_token=token)


# ============================================================================
# /auth/change-password — utilisateur connecté change son mot de passe en
# fournissant l'ancien (preuve d'identité). Validation : complexité +
# breach HIBP via validate_password. Différent du reset par lien email.
# ============================================================================
@router.post("/change-password", response_model=MessageOut)
@limiter.limit("5/hour")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 1. Vérifie l'ancien mot de passe
    if not verify_password(payload.current_password, user.hashed_password):
        record_auth_event(db, kind="password_change_failure", success=False, request=request,
                          user_id=user.id, email=user.email, detail="wrong_current_password")
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

    # 2. Empêche de réutiliser le même mot de passe
    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit être différent de l'ancien.")

    # 3. Valide la complexité + breach check HIBP
    ok, reason = validate_password(payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=reason or "Mot de passe trop faible.")

    # 4. Hash + commit + révocation des anciens tokens
    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1
    db.commit()

    # 5. Re-issue un cookie auth frais avec le nouveau token_version (les
    # autres sessions/anciens tokens deviennent invalides immédiatement).
    token = create_access_token(user.id, user.household_id, user.token_version)
    set_auth_cookie(response, token)
    record_auth_event(db, kind="password_change_success", success=True, request=request,
                      user_id=user.id, email=user.email)
    return MessageOut(message="Mot de passe mis à jour.")

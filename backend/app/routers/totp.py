"""
2FA TOTP endpoints (C19 2026-05-18) — setup, verify, disable.

Flow utilisateur :
1. POST /auth/totp/setup  → génère secret + otpauth URI (à scanner avec
   Google Authenticator / Authy / 1Password). Le secret est stocké en DB
   mais `totp_enabled` reste False jusqu'à la vérification.
2. POST /auth/totp/verify {code} → vérifie le code 6 chiffres + active.
   Si OK : `totp_enabled = True`. Tous les logins futurs exigeront un code.
3. POST /auth/totp/disable {password, code?} → vérifie le mot de passe
   (anti-takeover) + désactive. Vide totp_secret + totp_enabled = False.

Lib : pyotp 2.9.0 (utilisée par GitHub, Vault, Stripe en prod).
"""
import math
import time
import pyotp
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user, verify_password
from app.database import get_db
from app.models import User
from app.schemas import (
    TotpSetupOut, TotpVerifyIn, TotpDisableIn, MessageOut,
)
from app.security import record_auth_event
from app.rate_limit import limiter

router = APIRouter(prefix="/auth/totp", tags=["auth", "totp"])

TOTP_STEP = 30  # seconds per TOTP window


def _current_totp_window() -> int:
    """Return the current TOTP counter (floor(unix_ts / 30))."""
    return math.floor(time.time() / TOTP_STEP)


def _is_replay(user, window_offset: int = 0) -> bool:
    """Return True if the TOTP code for (now + window_offset*30s) was already used.

    We store the UTC timestamp of the last accepted code. A code is a replay
    if its 30s window start ≤ totp_last_otp_at (i.e. the same or older window).
    """
    if user.totp_last_otp_at is None:
        return False
    # Convert stored timestamp to aware UTC
    last = user.totp_last_otp_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    code_window_start = (_current_totp_window() + window_offset) * TOTP_STEP
    code_window_start_dt = datetime.fromtimestamp(code_window_start, tz=timezone.utc)
    return code_window_start_dt <= last


def _mark_totp_used(db, user) -> None:
    """Record the current time as the last accepted TOTP timestamp."""
    user.totp_last_otp_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/setup", response_model=TotpSetupOut)
@limiter.limit("5/hour")
def totp_setup(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Génère un nouveau secret TOTP pour l'utilisateur courant.

    Le secret est stocké en DB mais `totp_enabled` reste False — le user
    doit confirmer via /verify avant que la 2FA soit active.
    Si un setup précédent était en cours (non vérifié), il est écrasé.
    """
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA déjà activé. Désactivez d'abord pour reconfigurer.")
    secret = pyotp.random_base32()
    user.totp_secret = secret
    # On garde totp_enabled = False jusqu'à la vérification
    db.commit()

    totp = pyotp.TOTP(secret)
    otpauth_uri = totp.provisioning_uri(name=user.email, issuer_name="Yotori Finance")
    return TotpSetupOut(secret=secret, otpauth_uri=otpauth_uri)


@router.post("/verify", response_model=MessageOut)
@limiter.limit("10/hour")
def totp_verify(
    payload: TotpVerifyIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Vérifie le code 6 chiffres et active la 2FA."""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Aucun setup TOTP en cours. Lancez d'abord /setup.")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        record_auth_event(db, kind="totp_verify_failure", success=False,
                          request=request, user_id=user.id, email=user.email)
        raise HTTPException(status_code=401, detail="Code 2FA incorrect")
    # Anti-replay: reject if this 30s window was already used
    if _is_replay(user):
        record_auth_event(db, kind="totp_verify_failure", success=False,
                          request=request, user_id=user.id, email=user.email,
                          detail="replay_attack")
        raise HTTPException(status_code=401, detail="Code 2FA déjà utilisé. Attendez le prochain code.")
    user.totp_enabled = True
    _mark_totp_used(db, user)
    record_auth_event(db, kind="totp_enabled", success=True,
                      request=request, user_id=user.id, email=user.email)
    return MessageOut(message="2FA activé avec succès.")


@router.post("/disable", response_model=MessageOut)
@limiter.limit("5/hour")
def totp_disable(
    payload: TotpDisableIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Désactive la 2FA — exige le mot de passe (anti-takeover en cas de
    session volée). Le code TOTP est demandé en bonus si disponible."""
    if not verify_password(payload.password, user.hashed_password):
        record_auth_event(db, kind="totp_disable_failure", success=False,
                          request=request, user_id=user.id, email=user.email,
                          detail="bad_password")
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    # Si un code TOTP est fourni ET 2FA déjà actif, on le vérifie aussi
    if user.totp_enabled and payload.code:
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(payload.code, valid_window=1):
            raise HTTPException(status_code=401, detail="Code 2FA incorrect")
    user.totp_enabled = False
    user.totp_secret = None
    db.commit()
    record_auth_event(db, kind="totp_disabled", success=True,
                      request=request, user_id=user.id, email=user.email)
    return MessageOut(message="2FA désactivé.")


@router.get("/status")
def totp_status(user: User = Depends(get_current_user)):
    """État 2FA pour l'écran Réglages → Sécurité."""
    return {
        "enabled": bool(user.totp_enabled),
        "setup_in_progress": bool(user.totp_secret and not user.totp_enabled),
    }

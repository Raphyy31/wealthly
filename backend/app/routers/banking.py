"""
GoCardless Bank Account Data (ex-Nordigen) integration.

Flow :
  1. /banks                — list French banks (institutions)
  2. /connect              — create end-user agreement + requisition →
                             returns a redirect URL where the user authenticates
                             at their bank.
  3. Bank redirects back to {GOCARDLESS_REDIRECT_URI}?ref={state}
  4. /complete             — fetch requisition status → accounts available
  5. /sync/{connection_id} — pull transactions for the linked accounts and
                             import them into Wealthly accounts.

Credentials :
  - GOCARDLESS_SECRET_ID
  - GOCARDLESS_SECRET_KEY
Both available at https://bankaccountdata.gocardless.com/user/secrets/

Tokens :
  Access tokens last 24 h, refresh tokens 30 days. We cache the access token
  in-process (single uvicorn worker assumed) and lazily refresh on 401 or
  scheduled expiry. The Wealthly deployment fits in a single worker so a
  simple module-global cache is enough.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Account, BankConnection, Transaction, User


def parse_iso_date(s: str):
    """Parse a YYYY-MM-DD date string into a date object."""
    return datetime.strptime(s[:10], "%Y-%m-%d").date()

logger = logging.getLogger("wealthly.banking")
router = APIRouter(prefix="/banking", tags=["banking"])


# ─── Token cache ────────────────────────────────────────────────────────────

_token_cache: dict = {
    "access": None,
    "access_expires_at": None,  # datetime, leave ~60s margin before expiry
    "refresh": None,
    "refresh_expires_at": None,
}
_token_lock = asyncio.Lock()


async def _get_access_token() -> str:
    """Return a valid access token, refreshing or re-issuing as needed."""
    if not settings.GOCARDLESS_SECRET_ID or not settings.GOCARDLESS_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Connexion bancaire non configurée. Renseigne "
                "GOCARDLESS_SECRET_ID + GOCARDLESS_SECRET_KEY dans Railway."
            ),
        )

    async with _token_lock:
        now = datetime.utcnow()
        # Fast path: access token still valid
        if _token_cache["access"] and _token_cache["access_expires_at"] and now < _token_cache["access_expires_at"]:
            return _token_cache["access"]

        # Refresh path
        refresh = _token_cache.get("refresh")
        refresh_expires = _token_cache.get("refresh_expires_at")
        if refresh and refresh_expires and now < refresh_expires:
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    r = await client.post(
                        f"{settings.GOCARDLESS_API_BASE}/token/refresh/",
                        json={"refresh": refresh},
                    )
                if r.status_code == 200:
                    data = r.json()
                    _token_cache["access"] = data["access"]
                    _token_cache["access_expires_at"] = now + timedelta(seconds=int(data.get("access_expires", 86400)) - 60)
                    return _token_cache["access"]
            except Exception as e:
                logger.warning("[gocardless] refresh failed (%s), falling back to /token/new/", e)

        # Cold start: full credential exchange
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                f"{settings.GOCARDLESS_API_BASE}/token/new/",
                json={
                    "secret_id": settings.GOCARDLESS_SECRET_ID,
                    "secret_key": settings.GOCARDLESS_SECRET_KEY,
                },
            )
        if r.status_code != 200:
            logger.error("[gocardless] /token/new/ failed: %s %s", r.status_code, r.text[:300])
            raise HTTPException(status_code=502, detail="GoCardless: échec de l'authentification (vérifie les clés Railway)")
        data = r.json()
        _token_cache["access"] = data["access"]
        _token_cache["access_expires_at"] = now + timedelta(seconds=int(data.get("access_expires", 86400)) - 60)
        _token_cache["refresh"] = data["refresh"]
        _token_cache["refresh_expires_at"] = now + timedelta(seconds=int(data.get("refresh_expires", 2592000)) - 60)
        return _token_cache["access"]


async def _gc(method: str, path: str, body: dict | None = None, params: dict | None = None, _retry: bool = True) -> dict:
    """Authenticated GoCardless request with single 401-retry (token refresh)."""
    token = await _get_access_token()
    url = f"{settings.GOCARDLESS_API_BASE}{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.request(
            method,
            url,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            json=body if method != "GET" else None,
            params=params,
        )
    if r.status_code == 401 and _retry:
        # Drop cache and retry once
        _token_cache["access"] = None
        return await _gc(method, path, body=body, params=params, _retry=False)
    if r.status_code >= 400:
        try:
            detail = r.json()
        except Exception:
            detail = r.text[:300]
        logger.warning("[gocardless] %s %s → %s %s", method, path, r.status_code, detail)
        raise HTTPException(status_code=502, detail=f"GoCardless {r.status_code}: {detail}")
    # 204 No Content (e.g. DELETE)
    if r.status_code == 204 or not r.text:
        return {}
    return r.json()


# ─── Request / response models ──────────────────────────────────────────────

class ConnectRequest(BaseModel):
    bank_name: str       # GoCardless institution_id (e.g. "BNP_PARIBAS_BNPAFRPP")
    bank_country: str = "FR"


class CompleteRequest(BaseModel):
    # GoCardless returns ?ref={state} in the callback. We accept both names so
    # any old frontend code still works.
    state: Optional[str] = None
    code: Optional[str] = None   # ignored — GoCardless doesn't use OAuth code
    ref: Optional[str] = None


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/banks")
async def list_banks(
    country: str = Query("FR", min_length=2, max_length=2),
    current_user: User = Depends(get_current_user),
):
    """List institutions available in a country."""
    data = await _gc("GET", "/institutions/", params={"country": country.upper()})
    # GoCardless returns a list of {id, name, bic, transaction_total_days, logo, ...}
    return [
        {
            "id": inst.get("id"),
            "name": inst.get("name"),
            "bic": inst.get("bic"),
            "logo": inst.get("logo"),
            "transaction_total_days": int(inst.get("transaction_total_days") or 90),
            "max_access_valid_for_days": int(inst.get("max_access_valid_for_days") or 90),
            "country": country.upper(),
        }
        for inst in (data if isinstance(data, list) else data.get("results", []))
    ]


@router.post("/connect")
async def connect_bank(
    body: ConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create an end-user agreement + requisition.
    Returns the URL where the user must authenticate at their bank.
    """
    state = str(uuid.uuid4())

    # Each institution caps how far back we can pull transactions
    # (transaction_total_days). Pulling more than that returns a 400. Read
    # the institution's caps before creating the agreement so we always
    # request a valid window.
    try:
        inst = await _gc("GET", f"/institutions/{body.bank_name}/")
    except HTTPException as e:
        if e.status_code == 502 and "404" in str(e.detail):
            raise HTTPException(status_code=400, detail=f"Banque inconnue: {body.bank_name}")
        raise
    max_hist_cap = int(inst.get("transaction_total_days") or 90)
    max_access_cap = int(inst.get("max_access_valid_for_days") or 90)
    max_hist = min(180, max_hist_cap)
    access_valid = min(90, max_access_cap)

    # 1) End-User Agreement — defines what we'll access (balances + transactions)
    # and for how long. max_historical_days asks for back-fill; access_valid_for_days
    # controls how long our session stays valid before the user has to re-consent.
    agreement = await _gc(
        "POST",
        "/agreements/enduser/",
        body={
            "institution_id": body.bank_name,
            "max_historical_days": max_hist,
            "access_valid_for_days": access_valid,
            "access_scope": ["balances", "details", "transactions"],
        },
    )

    # 2) Requisition — generates the user-facing redirect URL
    requisition = await _gc(
        "POST",
        "/requisitions/",
        body={
            "redirect": settings.GOCARDLESS_REDIRECT_URI,
            "institution_id": body.bank_name,
            "agreement": agreement["id"],
            "reference": state,        # comes back as ?ref={state} on redirect
            "user_language": "fr",
        },
    )

    conn = BankConnection(
        household_id=current_user.household_id,
        session_id=requisition["id"],   # repurposed for GoCardless requisition_id
        bank_name=body.bank_name,
        bank_country=body.bank_country.upper(),
        status="pending",
        state=state,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)

    return {
        "connection_id": conn.id,
        "redirect_url": requisition["link"],
        "state": state,
    }


@router.post("/complete")
async def complete_connection(
    body: CompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called by the frontend after the bank redirects back with ?ref={state}.
    Pulls the requisition status from GoCardless and stores the linked accounts.
    """
    state = body.state or body.ref
    if not state:
        raise HTTPException(status_code=400, detail="Référence (?ref=) absente du retour de la banque")

    conn = db.query(BankConnection).filter(
        BankConnection.state == state,
        BankConnection.household_id == current_user.household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable (référence inconnue)")

    if conn.status == "authorized":
        # idempotent
        return {"status": "authorized", "connection_id": conn.id, "accounts": conn.accounts_data or []}

    requisition = await _gc("GET", f"/requisitions/{conn.session_id}/")
    gc_status = requisition.get("status")        # CR | GC | UA | RJ | SA | GA | LN | SU | EX
    account_ids = requisition.get("accounts") or []

    logger.info("[banking] complete %s → gc_status=%s accounts=%d", conn.id, gc_status, len(account_ids))

    if gc_status == "LN" and account_ids:
        # Fetch account details to enrich what we show in the UI
        enriched = []
        for acc_id in account_ids:
            try:
                meta = await _gc("GET", f"/accounts/{acc_id}/")
                details = await _gc("GET", f"/accounts/{acc_id}/details/")
                acc_obj = details.get("account") or {}
                enriched.append({
                    "id": acc_id,
                    "iban": meta.get("iban") or acc_obj.get("iban"),
                    "name": acc_obj.get("name") or acc_obj.get("displayName") or acc_obj.get("ownerName") or "Compte",
                    "currency": acc_obj.get("currency") or "EUR",
                    "owner_name": acc_obj.get("ownerName") or "",
                    "product": acc_obj.get("product") or "",
                    "institution_id": meta.get("institution_id") or body_to_institution_id(conn),
                })
            except Exception as e:
                logger.warning("[banking] account %s detail fetch failed: %s", acc_id, e)
                enriched.append({"id": acc_id})
        conn.status = "authorized"
        conn.accounts_data = enriched
    elif gc_status in ("RJ", "EX", "SU"):
        conn.status = "error"
        conn.error_message = f"GoCardless status: {gc_status}"
    # else still pending (CR / GC / UA / SA / GA)

    db.commit()
    db.refresh(conn)

    return {
        "status": conn.status,
        "connection_id": conn.id,
        "accounts": conn.accounts_data or [],
        "session_status": gc_status,
    }


def body_to_institution_id(conn: BankConnection) -> str:
    return conn.bank_name or ""


# ─── Sync ───────────────────────────────────────────────────────────────────

@router.post("/sync/{connection_id}")
async def sync_transactions(
    connection_id: str,
    days_back: int = Query(90, ge=1, le=720),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Pull transactions for every linked account in this connection.
    Creates Wealthly accounts on first sync, then upserts transactions
    (uniqueness via (account_id, external_id)).
    """
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == current_user.household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")
    if conn.status != "authorized" or not conn.accounts_data:
        raise HTTPException(status_code=400, detail="Connexion non autorisée")

    date_from = (datetime.utcnow() - timedelta(days=days_back)).date().isoformat()
    total_new = 0
    total_updated = 0

    for acc_info in conn.accounts_data:
        gc_acc_id = acc_info.get("id")
        if not gc_acc_id:
            continue
        # Find or create the Wealthly account (matched by external_id == gc_acc_id)
        wl_acc = db.query(Account).filter(
            Account.household_id == current_user.household_id,
            Account.external_id == gc_acc_id,
        ).first()
        if not wl_acc:
            # Fetch a current balance to seed the account.
            balance = 0.0
            try:
                bal_data = await _gc("GET", f"/accounts/{gc_acc_id}/balances/")
                balances = bal_data.get("balances", []) or []
                # Prefer interimAvailable then closingBooked
                for kind in ("interimAvailable", "closingBooked", "expected"):
                    match = next((b for b in balances if b.get("balanceType") == kind), None)
                    if match:
                        amt = match.get("balanceAmount", {})
                        balance = float(amt.get("amount", 0) or 0)
                        break
            except Exception as e:
                logger.warning("[banking] balance fetch failed for %s: %s", gc_acc_id, e)

            wl_acc = Account(
                household_id=current_user.household_id,
                name=acc_info.get("name") or "Compte",
                bank=conn.bank_name,
                type="checking",
                currency=(acc_info.get("currency") or "EUR").upper(),
                balance=balance,
                external_id=gc_acc_id,
                source="gocardless",
            )
            db.add(wl_acc)
            db.flush()

        # Transactions
        try:
            tx_data = await _gc("GET", f"/accounts/{gc_acc_id}/transactions/", params={"date_from": date_from})
        except Exception as e:
            logger.error("[banking] tx fetch failed for %s: %s", gc_acc_id, e)
            continue

        booked = (tx_data.get("transactions") or {}).get("booked", []) or []
        pending = (tx_data.get("transactions") or {}).get("pending", []) or []
        for raw in booked + pending:
            ext_id = raw.get("transactionId") or raw.get("internalTransactionId")
            if not ext_id:
                # Fall back to a deterministic synthetic id so we still dedupe
                ext_id = f"gc:{gc_acc_id}:{raw.get('bookingDate','')}:{raw.get('valueDate','')}:{(raw.get('transactionAmount') or {}).get('amount','')}:{raw.get('remittanceInformationUnstructured','')[:32]}"
            amt = (raw.get("transactionAmount") or {})
            amount = float(amt.get("amount") or 0)
            label = (
                raw.get("remittanceInformationUnstructured")
                or " ".join(raw.get("remittanceInformationUnstructuredArray") or [])
                or raw.get("creditorName")
                or raw.get("debtorName")
                or ""
            ).strip()
            date_str = raw.get("bookingDate") or raw.get("valueDate")
            tx_date = parse_iso_date(date_str) if date_str else datetime.utcnow().date()

            existing = db.query(Transaction).filter(
                Transaction.account_id == wl_acc.id,
                Transaction.external_id == ext_id,
            ).first()
            if existing:
                # Refresh in case label / amount got revised by the bank
                changed = False
                if abs((existing.amount or 0) - amount) > 0.005:
                    existing.amount = amount; changed = True
                if (existing.label or "") != label:
                    existing.label = label; changed = True
                if changed:
                    total_updated += 1
            else:
                db.add(Transaction(
                    account_id=wl_acc.id,
                    household_id=current_user.household_id,
                    date=tx_date,
                    amount=amount,
                    label=label,
                    source="gocardless",
                    external_id=ext_id,
                ))
                total_new += 1

    conn.last_synced_at = datetime.utcnow()
    db.commit()

    return {
        "connection_id": conn.id,
        "imported": total_new,
        "updated": total_updated,
        "last_synced_at": conn.last_synced_at.isoformat(),
    }


# ─── Connections list / delete / refresh ────────────────────────────────────

@router.get("/connections")
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(BankConnection).filter(
        BankConnection.household_id == current_user.household_id,
    ).order_by(BankConnection.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "bank_name": c.bank_name,
            "bank_country": c.bank_country,
            "status": c.status,
            "accounts": c.accounts_data or [],
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "error_message": c.error_message,
        }
        for c in rows
    ]


@router.post("/refresh/{connection_id}")
async def refresh_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-poll the requisition status — useful if /complete was called before
    the user finished bank authentication."""
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == current_user.household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")
    if not conn.session_id:
        raise HTTPException(status_code=400, detail="Pas de requisition GoCardless associée")

    requisition = await _gc("GET", f"/requisitions/{conn.session_id}/")
    gc_status = requisition.get("status")
    account_ids = requisition.get("accounts") or []

    if gc_status == "LN" and account_ids:
        enriched = []
        for acc_id in account_ids:
            try:
                meta = await _gc("GET", f"/accounts/{acc_id}/")
                details = await _gc("GET", f"/accounts/{acc_id}/details/")
                acc_obj = details.get("account") or {}
                enriched.append({
                    "id": acc_id,
                    "iban": meta.get("iban") or acc_obj.get("iban"),
                    "name": acc_obj.get("name") or acc_obj.get("displayName") or acc_obj.get("ownerName") or "Compte",
                    "currency": acc_obj.get("currency") or "EUR",
                    "owner_name": acc_obj.get("ownerName") or "",
                    "product": acc_obj.get("product") or "",
                })
            except Exception:
                enriched.append({"id": acc_id})
        conn.status = "authorized"
        conn.accounts_data = enriched
    elif gc_status in ("RJ", "EX", "SU"):
        conn.status = "error"
        conn.error_message = f"GoCardless status: {gc_status}"

    db.commit()
    db.refresh(conn)
    return {
        "id": conn.id,
        "status": conn.status,
        "accounts": conn.accounts_data or [],
        "session_status": gc_status,
    }


@router.delete("/connections/{connection_id}", status_code=204)
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the connection locally and best-effort delete the requisition
    on GoCardless side. Wealthly accounts already imported stay — only the
    open-banking link is severed."""
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == current_user.household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")
    if conn.session_id:
        try:
            await _gc("DELETE", f"/requisitions/{conn.session_id}/")
        except Exception as e:
            logger.warning("[gocardless] delete requisition %s failed: %s", conn.session_id, e)
    db.delete(conn)
    db.commit()
    return None

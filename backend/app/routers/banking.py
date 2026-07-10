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
                             import them into Yotori Finance accounts.

Credentials :
  - GOCARDLESS_SECRET_ID
  - GOCARDLESS_SECRET_KEY
Both available at https://bankaccountdata.gocardless.com/user/secrets/

Tokens :
  Access tokens last 24 h, refresh tokens 30 days. We cache the access token
  in-process (single uvicorn worker assumed) and lazily refresh on 401 or
  scheduled expiry. The Yotori Finance deployment fits in a single worker so a
  simple module-global cache is enough.
"""
import asyncio
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Account, BankConnection, Transaction, User, Category


def _iso_utc(dt) -> str | None:
    """Serialize a datetime as ISO 8601 WITH explicit UTC marker (`Z` suffix).

    Tous les datetime stockes dans la DB sont en UTC (datetime.utcnow). Sans
    le marker `Z` ou un offset, le frontend JavaScript parse la string comme
    local time -> ecart de 1-2h selon l'heure d'ete vs UTC. Bug remonte par
    user 2026-05-19 ("sync il y a 2h alors que j'ai sync il y a 5 min").

    Convention : on suffixe avec 'Z' (RFC 3339, plus court que +00:00, accepte
    par tous les parsers JS / Python).
    """
    if dt is None:
        return None
    # isoformat() sans tzinfo retourne "2026-05-19T16:30:00". On strippe les
    # microsecondes pour plus de proprete, puis on ajoute Z.
    return dt.replace(microsecond=0).isoformat() + "Z"


def parse_iso_date(s: str):
    """Parse a YYYY-MM-DD date string into a date object."""
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def _dedup_hash(account_id: str, date: str, amount: float, label: str) -> str:
    """Mirror the frontend hash used for CSV imports so synced + imported
    transactions don't double up if both happen to flow through Yotori Finance.

    BLAKE2b 16 octets (sécu F2 2026-05-19) — SHA-1 cassé depuis 2017,
    risque de faux positifs de dédup. BLAKE2b 128-bit suffit largement
    pour de la dédup non-cryptographique et n'a aucune collision connue.
    Note : les hashes existants restent valides (l'index dédup_hash en
    DB est just un VARCHAR sans contrainte d'algorithme)."""
    payload = f"{account_id}|{date}|{amount:.2f}|{(label or '')[:60].lower()}"
    return hashlib.blake2b(payload.encode("utf-8"), digest_size=16).hexdigest()

logger = logging.getLogger("yotori.banking")
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
                "Connexion bancaire non configurée. Renseignez "
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


class AccountNotReady(Exception):
    """GoCardless 409 « AccountProcessing » — les données du compte ne sont pas
    encore prêtes côté banque. Après une connexion fraîche, GoCardless prépare
    les balances/transactions en asynchrone (compte DISCOVERED → PROCESSING →
    READY) : tirer les données avant READY renvoie un 409. Ce n'est PAS une
    erreur fatale — le client doit réessayer plus tard (ou poller le status du
    compte). On la distingue d'un vrai échec pour afficher « synchronisation en
    cours » plutôt qu'une erreur (bug user 2026-07-10 : banque connectée, 0 tx).
    """
    pass


async def _gc(method: str, path: str, body: dict | None = None, params: dict | None = None, _retry: bool = True) -> dict:
    """Authenticated GoCardless request avec retry exponentiel sur les erreurs
    transitoires (429 rate-limit, 500/502/503/504 server, network errors).

    Retry policy : 3 tentatives, backoff 1.5s -> 3s -> 6s. Apres echec final,
    levee HTTPException avec un detail user-friendly (pas de "erreur interne"
    anonyme). Pattern utilise par tous les agregateurs serieux (Plaid, Tink,
    TrueLayer) car GoCardless prepare les comptes en async cote leur cote —
    le 1er appel apres une requisition peut renvoyer 429 ou 500 transitoire.
    """
    token = await _get_access_token()
    url = f"{settings.GOCARDLESS_API_BASE}{path}"

    last_exc: Exception | None = None
    last_status: int | None = None
    last_detail = None

    for attempt in range(3):
        if attempt > 0:
            # Backoff exponentiel : 1.5s, 3s, 6s. Donne le temps a GoCardless
            # de finir d'aggreger les comptes apres une requisition fraiche.
            await asyncio.sleep(1.5 * (2 ** (attempt - 1)))
            logger.info("[gocardless] retry %d/3 for %s %s", attempt + 1, method, path)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.request(
                    method,
                    url,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                    json=body if method != "GET" else None,
                    params=params,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_exc = e
            last_status = None
            logger.warning("[gocardless] network error attempt %d on %s %s: %s", attempt + 1, method, path, e)
            continue

        if r.status_code == 401 and _retry:
            # Token expire — vider le cache et reessayer une fois sans
            # consommer notre budget de retry general.
            _token_cache["access"] = None
            return await _gc(method, path, body=body, params=params, _retry=False)

        # Codes transitoires : on retry. Autres 4xx (400/403/404/409) : non
        # retryable, on echoue tout de suite avec un message utile.
        if r.status_code in (429, 500, 502, 503, 504):
            last_status = r.status_code
            try:
                last_detail = r.json()
            except Exception:
                last_detail = r.text[:300]
            # 429 « quota JOURNALIER » (GoCardless : "The daily request limit set
            # by the Institution has been exceeded") : ce n'est PAS transitoire —
            # retenter 3× gaspille 3 appels comptés sans aucune chance de succès
            # et accélère l'épuisement du quota (~4/jour/compte). On échoue tout
            # de suite avec un message honnête. Les 429 sans "daily" (burst juste
            # après une requisition) restent retentés comme avant.
            if r.status_code == 429 and "daily" in str(last_detail).lower():
                logger.info("[gocardless] 429 daily quota on %s %s: %s", method, path, last_detail)
                raise HTTPException(status_code=429, detail="Limite de rafraîchissement de la banque atteinte pour aujourd'hui (quota GoCardless). Réessaie demain.")
            logger.warning("[gocardless] transient %s on %s %s, will retry", r.status_code, method, path)
            continue

        # 409 AccountProcessing : données pas encore prêtes côté banque.
        # Signal distinct (pas un échec) → la sync l'affiche « en cours » et
        # réessaiera. Ne jamais retenter en boucle ici : ça brûlerait le quota
        # GoCardless (≈4 appels/jour/compte sur les données).
        if r.status_code == 409:
            try:
                detail = r.json()
            except Exception:
                detail = {}
            logger.info("[gocardless] 409 AccountProcessing on %s %s: %s", method, path, detail)
            raise AccountNotReady(str(detail)[:200] if detail else "AccountProcessing")

        if r.status_code >= 400:
            try:
                detail = r.json()
            except Exception:
                detail = r.text[:300]
            logger.warning("[gocardless] %s %s -> %s %s", method, path, r.status_code, detail)
            # Messages user-friendly selon le code
            if r.status_code == 403:
                raise HTTPException(status_code=403, detail="Acces refuse par la banque (consentement expire ou revoque). Reconnectez la banque depuis Reglages.")
            if r.status_code == 404:
                raise HTTPException(status_code=404, detail="Compte introuvable cote banque. La connexion est peut-etre obsolete.")
            raise HTTPException(status_code=502, detail=f"Erreur banque ({r.status_code})")

        # 204 No Content (e.g. DELETE) or empty body
        if r.status_code == 204 or not r.text:
            return {}
        return r.json()

    # Tous les retries epuises — message user friendly selon la cause finale.
    if last_status == 429:
        raise HTTPException(status_code=429, detail="La banque est temporairement debordee. Reessayez dans une minute.")
    if last_status in (500, 502, 503, 504):
        raise HTTPException(status_code=502, detail="La banque ne repond pas correctement pour le moment. Reessayez dans quelques instants.")
    if last_exc is not None:
        raise HTTPException(status_code=504, detail="Connexion a la banque trop lente. Verifiez votre reseau et reessayez.")
    raise HTTPException(status_code=502, detail="Echec de connexion a la banque apres plusieurs tentatives.")


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


# Caps par institution (transaction_total_days / max_access_valid_for_days).
# Ces valeurs ne changent pour ainsi dire jamais → cache process : la 2e
# connexion à la même banque économise un aller-retour GoCardless (le
# POST /connect passait 3 appels séquentiels — lent sur Railway froid,
# au point que le client abandonnait avant la redirection).
_INST_CAPS_CACHE: dict[str, tuple[int, int]] = {}


def _purge_stale_pending(db: Session, household_id: str, bank_name: str | None = None) -> int:
    """Supprime les connexions `pending` mortes du foyer.

    - Même banque (si bank_name fourni) : TOUTES les pending — l'utilisateur
      relance une connexion, les tentatives précédentes n'aboutiront plus
      proprement et polluaient Réglages (« 4 fois la même banque non
      synchronisée », bug user 2026-07-03).
    - Toutes banques : les pending de plus de 48 h (consentement abandonné).
    """
    q = db.query(BankConnection).filter(
        BankConnection.household_id == household_id,
        BankConnection.status == "pending",
    )
    cutoff = datetime.utcnow() - timedelta(hours=48)
    stale = [
        c for c in q.all()
        if (bank_name and c.bank_name == bank_name)
        or (c.created_at and c.created_at < cutoff)
    ]
    for c in stale:
        db.delete(c)
    return len(stale)


@router.post("/connect")
async def connect_bank(
    body: ConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    household_id = current_user.household_id
    """
    Create an end-user agreement + requisition.
    Returns the URL where the user must authenticate at their bank.
    """
    state = str(uuid.uuid4())

    # Nettoyage AVANT création : les pending de cette banque (tentatives
    # précédentes abandonnées) + les pending > 48 h toutes banques. Sans ça,
    # chaque clic laissait une ligne « non synchronisé » de plus dans Réglages.
    purged = _purge_stale_pending(db, household_id, bank_name=body.bank_name)
    if purged:
        logger.info("[banking] connect: %d pending obsolète(s) purgé(s) pour %s", purged, body.bank_name)

    # Each institution caps how far back we can pull transactions
    # (transaction_total_days). Pulling more than that returns a 400. Read
    # the institution's caps before creating the agreement so we always
    # request a valid window. Caps cachés par process (cf. _INST_CAPS_CACHE).
    if body.bank_name in _INST_CAPS_CACHE:
        max_hist_cap, max_access_cap = _INST_CAPS_CACHE[body.bank_name]
    else:
        try:
            inst = await _gc("GET", f"/institutions/{body.bank_name}/")
        except HTTPException as e:
            if e.status_code == 502 and "404" in str(e.detail):
                raise HTTPException(status_code=400, detail=f"Banque inconnue: {body.bank_name}")
            raise
        max_hist_cap = int(inst.get("transaction_total_days") or 90)
        max_access_cap = int(inst.get("max_access_valid_for_days") or 90)
        _INST_CAPS_CACHE[body.bank_name] = (max_hist_cap, max_access_cap)
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
        household_id=household_id,
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
    household_id = current_user.household_id
    state = body.state or body.ref
    if not state:
        raise HTTPException(status_code=400, detail="Référence (?ref=) absente du retour de la banque")

    conn = db.query(BankConnection).filter(
        BankConnection.state == state,
        BankConnection.household_id == household_id,
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
                    "cash_account_type": acc_obj.get("cashAccountType") or "",
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

async def _sync_one_connection(
    conn: BankConnection,
    household_id: str,
    days_back: int,
    db: Session,
) -> dict:
    """Sync logic factorisée — utilisée par l'endpoint user-facing
    /sync/{connection_id} ET le cron nightly /cron/sync-all.

    Retourne {imported, updated, skipped, errors, last_synced_at}.
    """
    if conn.status != "authorized" or not conn.accounts_data:
        raise HTTPException(status_code=400, detail="Connexion non autorisée")

    # RLS : poser le contexte du foyer. INDISPENSABLE pour le cron nightly
    # `cron_sync_all` (aucun user authentifié → variable non posée → sous
    # FORCE RLS la sync ne voit/écrit aucune ligne). set_rls_context mémorise
    # aussi le foyer sur la session → ré-affirmé automatiquement après chaque
    # commit (les syncs commitent plusieurs fois).
    from app.database import set_rls_context
    set_rls_context(db, household_id)

    date_from = (datetime.utcnow() - timedelta(days=days_back)).date().isoformat()
    total_new = 0
    total_updated = 0
    total_skipped = 0
    batch_hashes = set()
    new_tx_ids: list[str] = []
    errors: list[str] = []
    accounts_pending: list[str] = []   # comptes encore en préparation côté banque
    accounts_read = 0                  # comptes effectivement lus (données prêtes)

    from app.models import Member  # local import to avoid circular at module load
    household_members = db.query(Member).filter(
        Member.household_id == household_id,
    ).all()

    for acc_info in conn.accounts_data:
        gc_acc_id = acc_info.get("id")
        if not gc_acc_id:
            continue
        acc_label = acc_info.get("name") or gc_acc_id

        # ── Les données du compte sont-elles prêtes côté GoCardless ? ─────────
        # Après une connexion fraîche le compte passe DISCOVERED → PROCESSING →
        # READY. Tirer balances/transactions avant READY renvoie un 409
        # AccountProcessing → l'ancienne sync remontait « Erreur banque (409) »
        # avalée en silence, d'où « banque connectée mais 0 opération ». On lit
        # d'abord le statut via l'endpoint métadonnées /accounts/{id}/ (NON
        # soumis au quota des ~4 appels/jour des scopes données) et on saute
        # proprement les comptes pas encore prêts : le re-sync (auto côté front
        # ou cron nightly) finira le travail.
        try:
            acc_meta = await _gc("GET", f"/accounts/{gc_acc_id}/")
            acc_status = (acc_meta.get("status") or "").upper()
        except AccountNotReady:
            acc_status = "PROCESSING"
        except Exception as e:
            logger.warning("[banking] account status fetch failed for %s: %s", gc_acc_id, e)
            acc_status = ""   # inconnu → on tente quand même (best-effort)

        if acc_status in ("PROCESSING", "DISCOVERED"):
            accounts_pending.append(acc_label)
            logger.info("[banking] account %s not ready (%s) — skip, will retry", gc_acc_id[:8], acc_status)
            continue
        if acc_status in ("ERROR", "SUSPENDED", "EXPIRED"):
            errors.append(f"{acc_label} : compte {acc_status.lower()} côté banque")
            continue

        # Find or create the Yotori Finance account (matched by external_id == gc_acc_id)
        wl_acc = db.query(Account).filter(
            Account.household_id == household_id,
            Account.external_id == gc_acc_id,
        ).first()
        # Recupere le solde officiel a CHAQUE sync, pas seulement a la creation
        # (fix 2026-05-19 : retour user "solde Revolut totalement faux").
        # Ordre de priorite ameliore base sur les usages reels :
        #   interimAvailable : solde disponible immediat (Revolut, N26, Lydia)
        #                      = cash + virements re�us mais non encore booked
        #   closingAvailable : meme idee, certaines banques utilisent ce nom
        #   closingBooked    : solde apres les seules tx confirmees (BNP, CA)
        #   expected         : solde projete (rare)
        #   openingBooked    : solde de debut de journee (dernier recours)
        # Le 1er match trouve dans la liste ordonnee gagne.
        BALANCE_PRIORITY = (
            "interimAvailable",
            "closingAvailable",
            "closingBooked",
            "expected",
            "openingBooked",
        )
        official_balance = None
        try:
            bal_data = await _gc("GET", f"/accounts/{gc_acc_id}/balances/")
            balances = bal_data.get("balances", []) or []
        except AccountNotReady:
            # Course : status READY mais l'endpoint données répond encore 409.
            # On considère le compte "en cours" et on réessaiera plus tard.
            accounts_pending.append(acc_label)
            logger.info("[banking] account %s balances not ready yet — skip", gc_acc_id[:8])
            continue
        except Exception as e:
            # Erreur non-transitoire sur les SOLDES (403 scope refusé, 404,
            # 502 après retries épuisés…) : NE PAS faire échouer toute la sync.
            # On continue sans solde officiel — les transactions restent
            # récupérables. (Restaure le comportement d'avant le split du bloc :
            # sans ça, une erreur solde sur 1 compte tuait la connexion entière.)
            logger.warning("[banking] balance fetch failed for %s: %s", gc_acc_id, e)
            balances = []
        try:
            for kind in BALANCE_PRIORITY:
                match = next((b for b in balances if b.get("balanceType") == kind), None)
                if match:
                    amt = match.get("balanceAmount", {})
                    official_balance = float(amt.get("amount", 0) or 0)
                    logger.info("[banking] balance %s for %s : %s = %s", kind, gc_acc_id, gc_acc_id[:8], official_balance)
                    break
            if official_balance is None and balances:
                # Aucun balanceType connu — on prend le premier disponible
                # avec un montant valide plutot que de laisser le solde a None.
                first = next((b for b in balances if b.get("balanceAmount", {}).get("amount") is not None), None)
                if first:
                    official_balance = float(first["balanceAmount"]["amount"])
                    logger.warning("[banking] no known balanceType for %s, fell back to first: %s", gc_acc_id, first.get("balanceType"))
        except Exception as e:
            logger.warning("[banking] balance fetch failed for %s: %s", gc_acc_id, e)

        if not wl_acc:
            # Heuristic account type from the bank's "product" string + cashAccountType.
            # GoCardless returns these in the /accounts/{id}/details/ payload.
            product = (acc_info.get("product") or "").lower()
            cash_type = (acc_info.get("cash_account_type") or "").upper()
            if "pea" in product:
                acc_type = "pea"
            elif "livret" in product or "epargne" in product or "saving" in product or cash_type == "SVGS":
                acc_type = "savings"
            elif "assurance vie" in product or "assurance-vie" in product:
                acc_type = "life_insurance"
            elif "credit" in product or "crédit" in product or cash_type == "CARD":
                acc_type = "credit"
            else:
                acc_type = "checking"

            wl_acc = Account(
                household_id=household_id,
                name=acc_info.get("name") or "Compte",
                bank=conn.bank_name,
                type=acc_type,
                currency=(acc_info.get("currency") or "EUR").upper(),
                initial_balance=official_balance if official_balance is not None else 0.0,
                external_id=gc_acc_id,
                iban=acc_info.get("iban"),
                source="gocardless",
                members=[m for m in household_members if m.role == 'adult'],  # children excluded from account membership
            )
            db.add(wl_acc)
            db.flush()
        else:
            # Backfill IBAN on accounts created before the column existed.
            if not wl_acc.iban and acc_info.get("iban"):
                wl_acc.iban = acc_info.get("iban")

        # Stocker le solde officiel a chaque sync (cle du fix solde Revolut).
        if official_balance is not None:
            wl_acc.last_known_balance = official_balance
            wl_acc.last_balance_at = datetime.utcnow()

        # Transactions
        try:
            tx_data = await _gc("GET", f"/accounts/{gc_acc_id}/transactions/", params={"date_from": date_from})
        except AccountNotReady:
            # Données transactions pas encore prêtes (course post-connexion) →
            # on réessaiera. Le compte + solde viennent d'être créés/màj, les
            # opérations arriveront au prochain sync.
            accounts_pending.append(acc_label)
            logger.info("[banking] account %s transactions not ready yet — skip", gc_acc_id[:8])
            continue
        except Exception as e:
            logger.error("[banking] tx fetch failed for %s: %s", gc_acc_id, e)
            errors.append(f"{acc_label} : {str(e)[:60]}")
            continue

        accounts_read += 1   # données lues avec succès pour ce compte
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

            dh = _dedup_hash(wl_acc.id, tx_date.isoformat(), amount, label)

            # 0) Already prepared in this same sync batch — skip duplicate.
            if dh in batch_hashes:
                total_skipped += 1
                continue

            # 1) Fast path: same external_id already imported.
            existing = db.query(Transaction).filter(
                Transaction.account_id == wl_acc.id,
                Transaction.external_id == ext_id,
            ).first()

            # 2) Fallback: same (household_id, dedup_hash) already exists.
            # Happens when the transaction was previously imported via CSV
            # (no external_id) and GoCardless is now pushing it with one.
            # Without this check the bulk INSERT trips the unique constraint
            # uq_household_dedup and the entire sync batch rolls back.
            if not existing:
                existing = db.query(Transaction).filter(
                    Transaction.household_id == household_id,
                    Transaction.dedup_hash == dh,
                ).first()
                if existing and not existing.external_id:
                    # Attach the GC external_id so future syncs hit path (1).
                    existing.external_id = ext_id
                    existing.source = "gocardless"

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
                    total_skipped += 1
            else:
                # ── Catégorisation automatique au moment du sync via le moteur
                # Payees + Category Learning + 120 règles builtin. Le user n'a
                # plus à cliquer 'Catégoriser via IA' à chaque sync — tout ce
                # qui est connu côté builtin/learning est résolu d'office.
                try:
                    from app.categorization import categorize_transaction as _cat
                    result = _cat(
                        label=label, amount=amount,
                        household_id=household_id, db=db, date=tx_date,
                    )
                    cat_id = None
                    if result.slug:
                        c = db.query(Category).filter(
                            Category.household_id == household_id,
                            Category.slug == result.slug,
                        ).first()
                        if c:
                            cat_id = c.id
                    payee_id_resolved = result.payee_id
                    cat_source = result.source
                    transfer_auto = True if result.is_transfer else None
                except Exception:
                    cat_id = None
                    payee_id_resolved = None
                    cat_source = None
                    transfer_auto = None

                new_tx = Transaction(
                    account_id=wl_acc.id,
                    household_id=household_id,
                    date=tx_date,
                    amount=amount,
                    label=label,
                    source="gocardless",
                    external_id=ext_id,
                    dedup_hash=dh,
                    category_id=cat_id,
                    payee_id=payee_id_resolved,
                    cat_source=cat_source,
                    is_transfer_override=transfer_auto,
                    # Marque comme à revoir post-sync. Le frontend ouvre une
                    # modale qui liste ces tx pour confirmation rapide de la
                    # catégorie/payee assignés automatiquement.
                    review_status="pending",
                )
                db.add(new_tx)
                db.flush()  # nécessaire pour récupérer l'id avant commit
                new_tx_ids.append(new_tx.id)
                total_new += 1
            batch_hashes.add(dh)

    # On n'horodate la sync que si on a effectivement lu au moins un compte.
    # Si TOUS les comptes sont encore en préparation (PROCESSING), on laisse
    # last_synced_at intact (None au 1er coup) → la connexion reste marquée
    # « synchronisation en cours » côté UI et le re-sync auto/cron réessaiera.
    if accounts_read > 0:
        conn.last_synced_at = datetime.utcnow()
    db.commit()

    # status "processing" tant qu'un compte n'a pas pu être lu → le frontend
    # relance en arrière-plan, sans brûler le quota (délais espacés).
    sync_status = "processing" if accounts_pending else "ready"

    return {
        "connection_id": conn.id,
        "imported": total_new,
        "updated": total_updated,
        "skipped": total_skipped,
        "errors": errors,
        "pending_accounts": accounts_pending,
        "accounts_read": accounts_read,
        "status": sync_status,
        "last_synced_at": _iso_utc(conn.last_synced_at),
        "new_tx_ids": new_tx_ids,
    }


# ─── Endpoints sync ────────────────────────────────────────────────────────

@router.post("/sync/{connection_id}")
async def sync_transactions(
    connection_id: str,
    days_back: int = Query(90, ge=1, le=720),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sync user-facing : appelle _sync_one_connection scopé au foyer du user."""
    household_id = current_user.household_id
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")
    return await _sync_one_connection(conn, household_id, days_back, db)


@router.post("/cron/sync-all")
async def cron_sync_all(
    request: Request,
    days_back: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Endpoint cron nightly : sync TOUTES les connexions autorisées de TOUS
    les foyers. Auth par header X-Cron-Secret (config CRON_SECRET).

    Idéalement schedulé via Railway cron (1×/jour, par ex. 04:00 UTC).
    days_back=7 par défaut pour rester rapide ; un re-sync historique se
    déclenche manuellement par foyer via l'endpoint /sync/{id}.

    Retourne le summary par foyer et global.
    """
    expected = (settings.CRON_SECRET or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="CRON_SECRET non configuré côté serveur")
    provided = request.headers.get("X-Cron-Secret", "")
    # hmac.compare_digest pour timing-safe comparison (audit sécu M4 2026-05-19)
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Header X-Cron-Secret invalide")

    # RLS : `bank_connections` est RLS-protégée → une requête globale sans
    # contexte renvoie 0 ligne. On itère les FOYERS (table `households` hors
    # RLS), on pose le contexte par foyer, puis on liste/sync ses connexions.
    from sqlalchemy import text as _text
    from app.models import Household
    total_imported = 0
    total_updated = 0
    total_skipped = 0
    failures: list[dict] = []
    results: list[dict] = []
    households = db.query(Household).all()
    for hh in households:
        try:
            db.execute(_text("SELECT set_config('app.current_household_id', :h, true)"), {"h": str(hh.id)})
        except Exception:
            pass
        conns = db.query(BankConnection).filter(BankConnection.status == "authorized").all()
        for conn in conns:
            try:
                res = await _sync_one_connection(conn, hh.id, days_back, db)
                total_imported += res.get("imported", 0)
                total_updated += res.get("updated", 0)
                total_skipped += res.get("skipped", 0)
                results.append({
                    "connection_id": conn.id, "household_id": hh.id,
                    "imported": res.get("imported", 0), "updated": res.get("updated", 0),
                    "errors": res.get("errors", []),
                })
            except Exception as e:
                logger.error("[cron-sync] connection %s failed: %s", conn.id, e)
                failures.append({"connection_id": conn.id, "household_id": hh.id, "error": str(e)[:200]})

    return {
        "connections_synced": len(results),
        "connections_failed": len(failures),
        "total_imported": total_imported,
        "total_updated": total_updated,
        "total_skipped": total_skipped,
        "results": results,
        "failures": failures,
        "completed_at": _iso_utc(datetime.utcnow()),
    }


# ─── Connections list / delete / refresh ────────────────────────────────────

@router.get("/connections")
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    household_id = current_user.household_id
    # Purge lazy des pending abandonnés (> 48 h) : la liste reste propre même
    # si l'utilisateur ne relance jamais de connexion.
    if _purge_stale_pending(db, household_id):
        db.commit()
    rows = db.query(BankConnection).filter(
        BankConnection.household_id == household_id,
    ).order_by(BankConnection.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "bank_name": c.bank_name,
            "bank_country": c.bank_country,
            "status": c.status,
            "accounts": c.accounts_data or [],
            "last_synced_at": _iso_utc(c.last_synced_at),
            "created_at": _iso_utc(c.created_at),
            "error_message": c.error_message,
        }
        for c in rows
    ]


@router.get("/connections/{connection_id}/diagnose")
async def diagnose_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Diagnostic santé d'une connexion bancaire (2026-05-19 — user request).

    Ping GoCardless en temps réel et compare avec l'état local :
    - status DB vs status GoCardless
    - last_synced_at + âge (heures depuis dernier sync)
    - expiration consentement (90 jours max — GoCardless ne renvoie pas
      explicitement la date d'expiration mais on déduit depuis created_at)
    - count des comptes et tx attachés

    Retourne un objet avec verdict global : "ok" / "warning" / "expired" / "error"
    + recommandation actionnable pour l'utilisateur.
    """
    household_id = current_user.household_id
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")

    result = {
        "connection_id": conn.id,
        "bank_name": conn.bank_name,
        "local_status": conn.status,
        "last_synced_at": _iso_utc(conn.last_synced_at),
        "created_at": _iso_utc(conn.created_at),
        "session_id": conn.session_id,
        "accounts_count": len(conn.accounts_data or []),
        "verdict": "ok",
        "issues": [],
        "recommendation": None,
    }

    # 1. Âge de la dernière sync
    if conn.last_synced_at:
        age_hours = (datetime.utcnow() - conn.last_synced_at).total_seconds() / 3600
        result["last_sync_age_hours"] = round(age_hours, 1)
        if age_hours > 168:  # 7 jours
            result["issues"].append(f"Dernière sync il y a {int(age_hours/24)} jours.")
            result["verdict"] = "warning"
    else:
        result["last_sync_age_hours"] = None
        result["issues"].append("Jamais synchronisé.")
        result["verdict"] = "warning"

    # 2. Âge de la connexion (GoCardless = 90 jours max DSP2)
    if conn.created_at:
        age_days = (datetime.utcnow() - conn.created_at).total_seconds() / 86400
        result["connection_age_days"] = int(age_days)
        if age_days > 83:
            result["issues"].append(f"Consentement créé il y a {int(age_days)} jours — expiration imminente (max 90 j DSP2).")
            result["verdict"] = "warning"
        if age_days > 90:
            result["issues"].append("Consentement probablement expiré.")
            result["verdict"] = "expired"

    # 3. Ping GoCardless pour récupérer le vrai status
    if conn.session_id:
        try:
            requisition = await _gc("GET", f"/requisitions/{conn.session_id}/")
            gc_status = requisition.get("status")
            result["gocardless_status"] = gc_status
            # Mapping status GoCardless :
            # CR=created GC=giving_consent UA=undergoing_auth RJ=rejected
            # SA=selecting_accounts GA=granting_access LN=linked SU=suspended EX=expired
            if gc_status == "EX":
                result["verdict"] = "expired"
                result["issues"].append("GoCardless : consentement EXPIRÉ. Reconnexion requise.")
                # Mettre à jour le local pour éviter les futures syncs qui échoueront
                if conn.status != "error":
                    conn.status = "error"
                    conn.error_message = "Consentement GoCardless expiré (status EX)"
                    db.commit()
            elif gc_status in ("RJ", "SU"):
                result["verdict"] = "error"
                result["issues"].append(f"GoCardless : statut {gc_status} (refusé/suspendu).")
            elif gc_status == "LN":
                # Bon état GoCardless — si on a un local status error, c'était stale
                if conn.status == "error":
                    result["issues"].append("Local indique erreur mais GoCardless est OK — incohérence (mise à jour locale).")
                    conn.status = "authorized"
                    conn.error_message = None
                    db.commit()
        except Exception as e:
            result["gocardless_status"] = "unreachable"
            result["issues"].append(f"Impossible de joindre GoCardless : {type(e).__name__}")
            # Ne pas dégrader le verdict — c'est probablement un timeout réseau
    else:
        result["gocardless_status"] = "no_session"
        result["issues"].append("Aucun session_id GoCardless — la connexion n'a jamais été complétée.")
        result["verdict"] = "error"

    # 4. Recommandation
    if result["verdict"] == "expired":
        result["recommendation"] = "Reconnectez votre banque : Réglages → Comptes bancaires → Supprimer cette connexion → + Connecter ma banque"
    elif result["verdict"] == "warning":
        result["recommendation"] = "Cliquez 'Sync' pour récupérer les dernières opérations. Si le problème persiste, reconnectez votre banque."
    elif result["verdict"] == "error":
        result["recommendation"] = "Contactez le support ou reconnectez votre banque."

    return result


@router.post("/refresh/{connection_id}")
async def refresh_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-poll the requisition status — useful if /complete was called before
    the user finished bank authentication."""
    household_id = current_user.household_id
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == household_id,
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


@router.delete("/connections/{connection_id}", status_code=200)
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprime la connexion bancaire ET les comptes Yotori Finance qui en dependent.

    Fix 2026-05-19 (retour user) : avant on gardait les Account orphelins,
    ce qui faisait apparaitre des "comptes fantomes" en sidebar apres
    deconnexion. Comportement contre-intuitif — l'utilisateur s'attend a
    un nettoyage complet quand il deconnecte la banque (pattern Lydia,
    Bankin, Linxo).

    Pour les comptes synces (source=gocardless, external_id match), cascade
    delete : Account.id -> ondelete CASCADE sur Transaction.account_id donc
    les transactions disparaissent aussi. Pour les comptes manuels lies
    historiquement, on les laisse intacts.

    Retourne le compte de comptes / transactions supprimes pour que le
    frontend puisse afficher un toast "Banque X deconnectee, N comptes
    retires" et pousse un reloadAll().
    """
    household_id = current_user.household_id
    conn = db.query(BankConnection).filter(
        BankConnection.id == connection_id,
        BankConnection.household_id == household_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable")

    # Best-effort : supprime la requisition cote GoCardless. On ignore l'erreur
    # pour ne pas bloquer la deconnexion locale si GoCardless est down.
    if conn.session_id:
        try:
            await _gc("DELETE", f"/requisitions/{conn.session_id}/")
        except Exception as e:
            logger.warning("[gocardless] delete requisition %s failed: %s", conn.session_id, e)

    # Recupere les external_id des comptes lies a cette connexion via
    # accounts_data (rempli pendant /complete).
    gc_account_ids = [
        a.get("id") for a in (conn.accounts_data or [])
        if a.get("id")
    ]

    deleted_accounts = 0
    deleted_transactions = 0
    if gc_account_ids:
        # Liste les Yotori Finance Account a supprimer pour pouvoir aussi compter
        # les transactions dans la reponse.
        to_delete = db.query(Account).filter(
            Account.household_id == household_id,
            Account.source == 'gocardless',
            Account.external_id.in_(gc_account_ids),
        ).all()
        for acc in to_delete:
            tx_count = db.query(Transaction).filter(Transaction.account_id == acc.id).count()
            deleted_transactions += tx_count
            db.delete(acc)
            deleted_accounts += 1

    db.delete(conn)
    db.commit()
    logger.info("[banking] disconnected %s — removed %d accounts, %d transactions",
                conn.bank_name or conn.id, deleted_accounts, deleted_transactions)
    return {
        "deleted_accounts": deleted_accounts,
        "deleted_transactions": deleted_transactions,
    }

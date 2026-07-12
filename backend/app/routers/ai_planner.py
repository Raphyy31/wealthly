"""
AI planner — extraction en langage naturel → objets structurés à VALIDER.

Deux usages :
  - POST /ai/plan/events : « je touche une prime de 1500 € le 20 mars et je
    paie 800 € d'impôts en septembre » → liste d'événements ponctuels
    (label / montant / sens / date ISO / compte) pour la Vue Projection.
  - POST /ai/plan/loan  : « prêt auto 15 000 € sur 48 mois à 3,5 % » → un
    emprunt structuré (capital / durée / taux / mensualité…).

Principe : l'IA ne fait QUE de l'extraction bornée à partir de ce que dit
l'utilisateur — elle n'invente aucun montant, ne crée rien en base. Le
frontend affiche une fiche pré-remplie que l'utilisateur VALIDE avant création.
Garde-fous de coût identiques au reste (provider unique + plafond mensuel).
"""
import json
import logging
from datetime import date as date_cls, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.config import settings
from app.models import User
from app.rate_limit import limiter
from app.services.ai_budget import under_cap, record_use

router = APIRouter(prefix="/ai/plan", tags=["ai"])
logger = logging.getLogger("yotori.ai_planner")


# ─── Schémas ────────────────────────────────────────────────────────────────
class AccountRef(BaseModel):
    id: str
    name: str = Field(default="", max_length=120)


class ParseEventsRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    today: Optional[date_cls] = None
    accounts: list[AccountRef] = Field(default_factory=list)


class ParsedEvent(BaseModel):
    label: str
    amount: float
    direction: str = "out"          # in | out
    date: Optional[date_cls] = None
    account_id: Optional[str] = None


class ParseEventsResponse(BaseModel):
    available: bool = True
    events: list[ParsedEvent] = Field(default_factory=list)
    note: Optional[str] = None


class ParseLoanRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ParsedLoan(BaseModel):
    name: str = "Prêt"
    type: str = "other_loan"        # mortgage | consumer_loan | auto_loan | student_loan | other_loan
    initial_capital: float = 0.0
    interest_rate: Optional[float] = None
    duration_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    start_date: Optional[date_cls] = None


class ParseLoanResponse(BaseModel):
    available: bool = True
    loan: Optional[ParsedLoan] = None
    note: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────
def _extract_json(raw: str) -> dict:
    """Parse la réponse LLM en objet JSON, en tolérant les fences ```json."""
    raw = (raw or "").strip()
    if "```" in raw:
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _call_llm(prompt: str) -> str:
    """Appel LLM court (extraction) via le provider résolu — modèle éco
    (catégorisation), pas le modèle coach."""
    from app.services.llm import resolve_provider, call_anthropic, call_openai
    provider = resolve_provider()
    if provider == "openai":
        return call_openai(prompt, model=settings.AI_MODEL_CATEGORIZE_OPENAI, max_tokens=700)
    return call_anthropic(prompt, model=settings.AI_MODEL_CATEGORIZE, max_tokens=700)


def _provider_available() -> bool:
    from app.services.llm import resolve_provider
    return resolve_provider() is not None


# ─── Endpoints ──────────────────────────────────────────────────────────────
@router.post("/events", response_model=ParseEventsResponse)
@limiter.limit("60/day")
def parse_events(
    payload: ParseEventsRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _provider_available():
        return ParseEventsResponse(available=False, note="Assistant IA non configuré.")

    hh = current_user.household_id
    try:
        if not under_cap(db, hh):
            return ParseEventsResponse(available=True, note="Plafond IA mensuel atteint — réessaie le mois prochain ou ajoute l'événement à la main.")
    except Exception as exc:
        logger.warning("[ai_planner] under_cap failed: %s", exc)

    today = payload.today or datetime.utcnow().date()
    accounts_txt = "\n".join(f'- id="{a.id}" nom="{a.name}"' for a in payload.accounts) or "(aucun compte fourni)"

    prompt = f"""Tu extrais des ÉVÉNEMENTS DE TRÉSORERIE PONCTUELS et FUTURS depuis une phrase en français.
Date d'aujourd'hui : {today.isoformat()}.

Comptes disponibles (pour rattacher un événement à un compte si l'utilisateur le précise) :
{accounts_txt}

Phrase de l'utilisateur :
\"\"\"{payload.message}\"\"\"

Règles ABSOLUES :
- N'invente AUCUN montant ni date. Utilise seulement ce qui est dit.
- `amount` est TOUJOURS positif. Le sens va dans `direction` : "in" (entrée d'argent : prime, remboursement, vente…) ou "out" (sortie : impôts, achat, facture…).
- Résous les dates relatives en date absolue ISO (YYYY-MM-DD) à partir d'aujourd'hui. « en septembre » = le 15 du prochain septembre à venir. « dans 3 mois » = aujourd'hui + 3 mois. Si aucune date n'est déductible, mets date = null.
- `account_id` : uniquement si l'utilisateur désigne clairement un des comptes ci-dessus (par son nom), sinon null.
- Ignore les mouvements récurrents/mensuels (ce ne sont pas des événements ponctuels).

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{{"events": [{{"label": "Prime", "amount": 1500, "direction": "in", "date": "2026-03-20", "account_id": null}}]}}
Si rien d'exploitable : {{"events": []}}"""

    try:
        raw = _call_llm(prompt)
        data = _extract_json(raw)
        record_use(db, hh)
    except Exception as exc:
        logger.warning("[ai_planner] events parse failed: %s", exc)
        return ParseEventsResponse(available=True, note="Je n'ai pas réussi à analyser la phrase. Reformule ou ajoute l'événement à la main.")

    valid_ids = {a.id for a in payload.accounts}
    events: list[ParsedEvent] = []
    for e in (data.get("events") or [])[:12]:
        try:
            label = str(e.get("label") or "").strip()[:120]
            amount = abs(float(e.get("amount") or 0))
            if not label or amount <= 0:
                continue
            direction = "in" if str(e.get("direction")).lower() == "in" else "out"
            d = e.get("date")
            parsed_date = None
            if d:
                try:
                    parsed_date = date_cls.fromisoformat(str(d)[:10])
                except (ValueError, TypeError):
                    parsed_date = None
            acc = e.get("account_id")
            acc = acc if acc in valid_ids else None
            events.append(ParsedEvent(label=label, amount=amount, direction=direction, date=parsed_date, account_id=acc))
        except (ValueError, TypeError):
            continue

    note = None if events else "Aucun événement ponctuel détecté dans la phrase."
    return ParseEventsResponse(available=True, events=events, note=note)


@router.post("/loan", response_model=ParseLoanResponse)
@limiter.limit("60/day")
def parse_loan(
    payload: ParseLoanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _provider_available():
        return ParseLoanResponse(available=False, note="Assistant IA non configuré.")

    hh = current_user.household_id
    try:
        if not under_cap(db, hh):
            return ParseLoanResponse(available=True, note="Plafond IA mensuel atteint — saisis le prêt à la main.")
    except Exception as exc:
        logger.warning("[ai_planner] under_cap failed: %s", exc)

    today = datetime.utcnow().date()
    prompt = f"""Tu extrais les caractéristiques d'un EMPRUNT depuis une phrase en français.
Date d'aujourd'hui : {today.isoformat()}.

Phrase de l'utilisateur :
\"\"\"{payload.message}\"\"\"

Règles ABSOLUES :
- N'invente AUCUN chiffre. Laisse null ce qui n'est pas dit.
- `type` ∈ ["mortgage" (immobilier), "consumer_loan" (conso), "auto_loan" (auto/voiture), "student_loan" (étudiant), "other_loan"]. Choisis le plus adapté au contexte, sinon "other_loan".
- `initial_capital` : le montant emprunté (nombre, en euros).
- `interest_rate` : taux annuel en % (ex : 3.5), sinon null.
- `duration_months` : durée en MOIS (convertis les années : 5 ans = 60), sinon null.
- `monthly_payment` : mensualité si explicitement donnée, sinon null (l'app la recalculera).
- `start_date` : date de début ISO (YYYY-MM-DD) si donnée, sinon null.
- `name` : libellé court et lisible (ex : "Prêt auto", "Crédit étudiant").

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{{"name": "Prêt auto", "type": "auto_loan", "initial_capital": 15000, "interest_rate": 3.5, "duration_months": 48, "monthly_payment": null, "start_date": null}}"""

    try:
        raw = _call_llm(prompt)
        data = _extract_json(raw)
        record_use(db, hh)
    except Exception as exc:
        logger.warning("[ai_planner] loan parse failed: %s", exc)
        return ParseLoanResponse(available=True, note="Je n'ai pas réussi à analyser la phrase. Reformule ou saisis le prêt à la main.")

    allowed_types = {"mortgage", "consumer_loan", "auto_loan", "student_loan", "other_loan"}
    def _num(v):
        try:
            n = float(v)
            return n if n > 0 else None
        except (ValueError, TypeError):
            return None

    ltype = str(data.get("type") or "other_loan")
    if ltype not in allowed_types:
        ltype = "other_loan"
    start = None
    if data.get("start_date"):
        try:
            start = date_cls.fromisoformat(str(data["start_date"])[:10])
        except (ValueError, TypeError):
            start = None
    dur = data.get("duration_months")
    try:
        dur = int(dur) if dur else None
    except (ValueError, TypeError):
        dur = None

    loan = ParsedLoan(
        name=str(data.get("name") or "Prêt").strip()[:120] or "Prêt",
        type=ltype,
        initial_capital=_num(data.get("initial_capital")) or 0.0,
        interest_rate=_num(data.get("interest_rate")),
        duration_months=dur,
        monthly_payment=_num(data.get("monthly_payment")),
        start_date=start,
    )
    note = None if loan.initial_capital > 0 else "Montant du prêt non détecté — complète-le à la main."
    return ParseLoanResponse(available=True, loan=loan, note=note)

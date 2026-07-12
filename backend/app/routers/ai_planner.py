"""Assistant IA de planification : extraction structurée, sans écriture en base."""
import json
import logging
from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Account, User
from app.rate_limit import limiter
from app.services.ai_budget import under_cap, record_use

router = APIRouter(prefix="/ai/plan", tags=["ai"])
logger = logging.getLogger("yotori.ai_planner")


class AccountRef(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    name: str = Field(default="", max_length=120)


class ParseEventsRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    today: Optional[date_cls] = None
    accounts: list[AccountRef] = Field(default_factory=list, max_length=50)


class ParsedEvent(BaseModel):
    label: str
    amount: float
    direction: str = "out"
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
    type: str = "other_loan"
    initial_capital: float = 0.0
    interest_rate: Optional[float] = None
    duration_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    start_date: Optional[date_cls] = None


class ParseLoanResponse(BaseModel):
    available: bool = True
    loan: Optional[ParsedLoan] = None
    note: Optional[str] = None


def _extract_json(raw: str) -> dict:
    """Tolère les fences Markdown tout en refusant une réponse non objet."""
    value = (raw or "").strip()
    if value.startswith("```"):
        value = value.split("\n", 1)[1] if "\n" in value else value[3:]
        value = value.rsplit("```", 1)[0].strip()
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("La réponse IA n'est pas un objet JSON")
    return parsed


def _call_llm(prompt: str) -> str:
    from app.services.llm import call_anthropic, call_openai, resolve_provider

    provider = resolve_provider()
    if provider == "openai":
        return call_openai(prompt, model=settings.AI_MODEL_CATEGORIZE_OPENAI, max_tokens=1200)
    if provider == "anthropic":
        return call_anthropic(prompt, model=settings.AI_MODEL_CATEGORIZE, max_tokens=1200)
    raise RuntimeError("provider_unavailable")


def _available() -> bool:
    from app.services.llm import resolve_provider
    return resolve_provider() is not None


def _can_use_ai(db: Session, household_id: str) -> bool:
    try:
        return under_cap(db, household_id)
    except Exception as exc:
        logger.warning("[ai_planner] vérification du plafond impossible: %s", exc)
        return False


@router.post("/events", response_model=ParseEventsResponse)
@limiter.limit("60/day")
def parse_events(
    payload: ParseEventsRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _available():
        return ParseEventsResponse(available=False, note="Assistant IA non configuré.")
    household_id = current_user.household_id
    if not _can_use_ai(db, household_id):
        return ParseEventsResponse(note="Plafond IA mensuel atteint — ajoutez l’événement à la main.")

    # Le client choisit des identifiants, mais le serveur fournit lui-même les
    # noms et élimine tout compte étranger avant d'envoyer le contexte au LLM.
    requested_ids = list(dict.fromkeys(a.id for a in payload.accounts))
    owned_accounts = (
        db.query(Account)
        .filter(Account.household_id == household_id, Account.id.in_(requested_ids))
        .all()
        if requested_ids else []
    )
    account_names = {a.id: a.name for a in owned_accounts}
    accounts_text = "\n".join(
        f'- id="{account_id}" nom="{account_names[account_id]}"'
        for account_id in requested_ids if account_id in account_names
    ) or "(aucun compte fourni)"
    today = payload.today or date_cls.today()
    prompt = f"""Tu extrais des événements de trésorerie ponctuels et futurs depuis une phrase en français.
Date d'aujourd'hui : {today.isoformat()}.
Comptes disponibles :
{accounts_text}

Phrase utilisateur :
\"\"\"{payload.message}\"\"\"

Règles :
- N'invente aucun montant ni date.
- amount est toujours positif ; direction vaut \"in\" pour une entrée ou \"out\" pour une sortie.
- Résous les dates relatives en YYYY-MM-DD. Pour \"en septembre\", choisis le 15 du prochain septembre. Sans date déductible, date vaut null.
- account_id vaut uniquement un id ci-dessus si le compte est clairement nommé, sinon null.
- Ignore les mouvements récurrents.
- Maximum 12 événements.

Réponds uniquement avec un objet JSON valide :
{{\"events\":[{{\"label\":\"Prime\",\"amount\":1500,\"direction\":\"in\",\"date\":\"2026-03-20\",\"account_id\":null}}]}}
Si rien n'est exploitable : {{\"events\":[]}}"""
    try:
        data = _extract_json(_call_llm(prompt))
        record_use(db, household_id)
    except Exception as exc:
        logger.warning("[ai_planner] analyse événements impossible: %s", exc)
        return ParseEventsResponse(note="Je n’ai pas réussi à analyser la phrase. Reformulez-la ou ajoutez l’événement à la main.")

    valid_ids = set(account_names)
    events = []
    raw_events = data.get("events")
    for item in (raw_events if isinstance(raw_events, list) else [])[:12]:
        if not isinstance(item, dict):
            continue
        try:
            label = str(item.get("label") or "").strip()[:120]
            amount = abs(float(item.get("amount") or 0))
            if not label or amount <= 0:
                continue
            parsed_date = None
            if item.get("date"):
                try:
                    parsed_date = date_cls.fromisoformat(str(item["date"])[:10])
                except (TypeError, ValueError):
                    pass
            account_id = item.get("account_id")
            events.append(ParsedEvent(
                label=label,
                amount=amount,
                direction="in" if str(item.get("direction")).lower() == "in" else "out",
                date=parsed_date,
                account_id=account_id if account_id in valid_ids else None,
            ))
        except (TypeError, ValueError):
            continue
    return ParseEventsResponse(
        events=events,
        note=None if events else "Aucun événement ponctuel détecté dans la phrase.",
    )


@router.post("/loan", response_model=ParseLoanResponse)
@limiter.limit("60/day")
def parse_loan(
    payload: ParseLoanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _available():
        return ParseLoanResponse(available=False, note="Assistant IA non configuré.")
    household_id = current_user.household_id
    if not _can_use_ai(db, household_id):
        return ParseLoanResponse(note="Plafond IA mensuel atteint — saisissez le prêt à la main.")

    prompt = f"""Tu extrais les caractéristiques d'un emprunt depuis une phrase en français.
Date d'aujourd'hui : {date_cls.today().isoformat()}.
Phrase utilisateur : \"\"\"{payload.message}\"\"\"

Règles : n'invente aucun chiffre ; utilise null si une valeur n'est pas dite.
type vaut mortgage, consumer_loan, auto_loan, student_loan ou other_loan.
initial_capital est en euros, interest_rate est le taux annuel en %, duration_months est la durée en mois,
monthly_payment est renseignée seulement si elle est dite, start_date est au format YYYY-MM-DD.
Réponds uniquement avec un objet JSON valide :
{{\"name\":\"Prêt auto\",\"type\":\"auto_loan\",\"initial_capital\":15000,\"interest_rate\":3.5,\"duration_months\":48,\"monthly_payment\":null,\"start_date\":null}}"""
    try:
        data = _extract_json(_call_llm(prompt))
        record_use(db, household_id)
    except Exception as exc:
        logger.warning("[ai_planner] analyse emprunt impossible: %s", exc)
        return ParseLoanResponse(note="Je n’ai pas réussi à analyser la phrase. Reformulez-la ou saisissez le prêt à la main.")

    def positive(value):
        try:
            number = float(value)
            return number if number > 0 else None
        except (TypeError, ValueError):
            return None

    def non_negative(value):
        try:
            number = float(value)
            return number if number >= 0 else None
        except (TypeError, ValueError):
            return None

    allowed_types = {"mortgage", "consumer_loan", "auto_loan", "student_loan", "other_loan"}
    loan_type = str(data.get("type") or "other_loan")
    if loan_type not in allowed_types:
        loan_type = "other_loan"
    try:
        duration = int(data["duration_months"]) if data.get("duration_months") else None
        if duration is not None and duration <= 0:
            duration = None
    except (TypeError, ValueError):
        duration = None
    start_date = None
    if data.get("start_date"):
        try:
            start_date = date_cls.fromisoformat(str(data["start_date"])[:10])
        except (TypeError, ValueError):
            pass
    capital = positive(data.get("initial_capital")) or 0.0
    loan = ParsedLoan(
        name=str(data.get("name") or "Prêt").strip()[:120] or "Prêt",
        type=loan_type,
        initial_capital=capital,
        interest_rate=non_negative(data.get("interest_rate")),
        duration_months=duration,
        monthly_payment=positive(data.get("monthly_payment")),
        start_date=start_date,
    )
    return ParseLoanResponse(
        loan=loan,
        note=None if capital > 0 else "Montant du prêt non détecté — complétez-le à la main.",
    )

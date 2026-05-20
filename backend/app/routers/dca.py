"""DCA Plans — systematic investment plan CRUD + reminder cron."""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
import re
import uuid
import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DcaPlan, User as UserModel, Household
from app.auth import get_current_user, User
from app.config import settings
from app.email_service import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dca", tags=["dca"])


class DcaPlanIn(BaseModel):
    name: str
    ticker: Optional[str] = None
    asset_name: Optional[str] = None
    amount: float
    currency: str = "EUR"
    frequency: str = "monthly"
    day_of_month: int = 1
    account_id: Optional[str] = None
    start_date: Optional[str] = None
    status: str = "active"
    target_years: int = 10
    expected_return: float = 7.0
    notes: Optional[str] = None
    member_ids: List[str] = []
    reminder_email_enabled: bool = False
    reminder_lead_days: int = 2

    @field_validator('account_id', 'ticker', 'asset_name', 'notes', 'start_date', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == '' else v


_MONTH_KEY_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class DcaExecutionsUpdate(BaseModel):
    """Replace the full executions map. Keys: YYYY-MM. Values: bool."""
    executions: Dict[str, bool]

    @field_validator('executions')
    @classmethod
    def validate_keys(cls, v):
        for key in v:
            if not _MONTH_KEY_RE.match(key):
                raise ValueError(f"Invalid month key: {key!r} (expected YYYY-MM)")
        return v


def _serialize(p: DcaPlan) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "ticker": p.ticker,
        "asset_name": p.asset_name,
        "amount": p.amount,
        "currency": p.currency,
        "frequency": p.frequency,
        "day_of_month": p.day_of_month,
        "account_id": p.account_id,
        "start_date": p.start_date,
        "status": p.status,
        "target_years": p.target_years,
        "expected_return": p.expected_return,
        "notes": p.notes,
        "member_ids": p.member_ids or [],
        "executions": p.executions or {},
        "reminder_email_enabled": bool(p.reminder_email_enabled),
        "reminder_lead_days": p.reminder_lead_days or 2,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
def list_plans(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plans = db.query(DcaPlan).filter(
        DcaPlan.household_id == current_user.household_id
    ).order_by(DcaPlan.created_at).all()
    return [_serialize(p) for p in plans]


@router.post("", status_code=201)
def create_plan(body: DcaPlanIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = DcaPlan(
        id=str(uuid.uuid4()),
        household_id=current_user.household_id,
        **body.model_dump(),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.put("/{plan_id}")
def update_plan(plan_id: str, body: DcaPlanIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(DcaPlan).filter(
        DcaPlan.id == plan_id,
        DcaPlan.household_id == current_user.household_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    for k, v in body.model_dump().items():
        setattr(plan, k, v)
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.put("/{plan_id}/executions")
def update_executions(
    plan_id: str,
    body: DcaExecutionsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the full executions map for a plan. Owner-only."""
    plan = db.query(DcaPlan).filter(
        DcaPlan.id == plan_id,
        DcaPlan.household_id == current_user.household_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    plan.executions = body.executions
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(DcaPlan).filter(
        DcaPlan.id == plan_id,
        DcaPlan.household_id == current_user.household_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    db.delete(plan)
    db.commit()


# ─── Reminder cron endpoint ─────────────────────────────────────────
# Endpoint a hit chaque jour (Railway cron). Protege par CRON_SECRET header.
# Pour chaque plan actif avec reminder_email_enabled=true, calcule la
# prochaine date d'execution et envoie un email si today + lead_days == exec_date.

def _next_execution_date(plan: DcaPlan, today: date) -> Optional[date]:
    """Calcule la prochaine date d'execution d'un plan a partir de today."""
    if plan.status != "active":
        return None
    day = max(1, min(28, plan.day_of_month or 1))
    freq = plan.frequency or "monthly"
    # Start with this month's exec day
    try:
        cand = date(today.year, today.month, day)
    except ValueError:
        return None
    if cand >= today:
        return cand
    # Sinon, mois suivant (ou +3 / +12 selon freq)
    months_ahead = {"monthly": 1, "quarterly": 3, "annual": 12}.get(freq, 1)
    y, m = today.year, today.month + months_ahead
    while m > 12:
        m -= 12
        y += 1
    try:
        return date(y, m, day)
    except ValueError:
        return None


@router.post("/cron/send-reminders")
def send_dca_reminders(
    x_cron_secret: str = Header(None, alias="X-Cron-Secret"),
    db: Session = Depends(get_db),
):
    """Trigger quotidien : envoie un email a chaque utilisateur dont un plan
    DCA arrive a echeance dans exactement reminder_lead_days jours."""
    if not settings.CRON_SECRET or not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")

    today = date.today()
    sent = 0
    plans = db.query(DcaPlan).filter(
        DcaPlan.reminder_email_enabled == True,  # noqa: E712
        DcaPlan.status == "active",
    ).all()

    for plan in plans:
        exec_date = _next_execution_date(plan, today)
        if not exec_date:
            continue
        delta = (exec_date - today).days
        if delta != (plan.reminder_lead_days or 2):
            continue
        # Trouve l'email du foyer (1er utilisateur du household)
        user = db.query(UserModel).filter(UserModel.household_id == plan.household_id).first()
        if not user or not user.email:
            continue
        # Build the email
        amount_str = f"{plan.amount:,.0f} {plan.currency or 'EUR'}".replace(",", " ")
        subject = f"Rappel DCA : {plan.name} dans {delta} jour{'s' if delta > 1 else ''}"
        exec_str = exec_date.strftime("%d/%m/%Y")
        html = f"""
        <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
          <div style="border-left: 3px solid #2540D9; padding-left: 14px; margin-bottom: 24px;">
            <div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #2540D9; font-weight: 600;">RAPPEL D'INVESTISSEMENT</div>
            <h1 style="margin: 6px 0 0; font-size: 22px; font-weight: 600; color: #16150F;">{plan.name}</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.5; color: #56544A; margin: 0 0 16px;">
            Ton prochain versement DCA arrive dans <strong style="color: #16150F;">{delta} jour{'s' if delta > 1 else ''}</strong>.
            Assure-toi d'avoir le cash nécessaire sur ton compte.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #E4E1D8; color: #8C8979;">Montant</td><td style="padding: 10px 0; border-bottom: 1px solid #E4E1D8; text-align: right; font-weight: 600; color: #16150F;">{amount_str}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #E4E1D8; color: #8C8979;">Date d'exécution</td><td style="padding: 10px 0; border-bottom: 1px solid #E4E1D8; text-align: right; font-weight: 600; color: #16150F;">{exec_str}</td></tr>
            <tr><td style="padding: 10px 0; color: #8C8979;">Fréquence</td><td style="padding: 10px 0; text-align: right; color: #16150F;">{plan.frequency}</td></tr>
          </table>
          <a href="https://wealthly-six.vercel.app/#/dca" style="display: inline-block; background: #2540D9; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">Voir mes plans DCA →</a>
          <p style="font-size: 12px; color: #8C8979; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E4E1D8;">
            Tu reçois cet email parce que les rappels sont activés sur ce plan. Désactive-les dans Wealthly → DCA.
          </p>
        </div>
        """
        text = f"Rappel : ton DCA '{plan.name}' arrive dans {delta} jour(s) ({exec_str}). Montant : {amount_str}."
        if send_email(user.email, subject, html, text):
            sent += 1
        else:
            logger.warning("DCA reminder email failed for plan %s user %s", plan.id, user.email)

    return {"plans_checked": len(plans), "emails_sent": sent}

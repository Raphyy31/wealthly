"""
Bilan mensuel par email — réglage opt-in, envoi de test, cron mensuel.

  GET  /reports/settings        → { monthly_report_enabled }
  PUT  /reports/settings        → bascule l'opt-in du foyer
  POST /reports/test            → envoie le bilan maintenant au user courant
  POST /reports/cron/send-monthly  (X-Cron-Secret) → envoie à tous les foyers opt-in

RLS : le cron n'a pas de user authentifié, donc `app.current_household_id`
n'est pas posé par get_current_user. Les tables (transactions, snapshots…)
sont RLS-protégées → on pose le contexte par foyer avant chaque lecture.
La table `households` est hors RLS, donc lister les foyers opt-in marche sans.
"""
from __future__ import annotations

import hmac
import logging
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Household
from app.config import settings
from app.services.monthly_report import (
    send_monthly_report, compute_monthly_report, last_completed_month,
)

logger = logging.getLogger("yotori.report")
router = APIRouter(prefix="/reports", tags=["reports"])


class ReportSettings(BaseModel):
    monthly_report_enabled: bool


@router.get("/settings", response_model=ReportSettings)
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hh = db.query(Household).filter(Household.id == user.household_id).first()
    return ReportSettings(monthly_report_enabled=bool(hh.monthly_report_enabled) if hh else False)


@router.put("/settings", response_model=ReportSettings)
def update_settings(payload: ReportSettings, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hh = db.query(Household).filter(Household.id == user.household_id).first()
    if not hh:
        raise HTTPException(status_code=404, detail="Foyer introuvable")
    hh.monthly_report_enabled = bool(payload.monthly_report_enabled)
    db.commit()
    return ReportSettings(monthly_report_enabled=hh.monthly_report_enabled)


@router.post("/test")
def send_test(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Envoie immédiatement le bilan au user courant (vérification visuelle).
    Essaie le mois écoulé, sinon le mois courant (pour avoir des données)."""
    # get_current_user a déjà posé app.current_household_id pour ce foyer.
    month = last_completed_month()
    data = compute_monthly_report(db, user.household_id, month)
    if not data:
        month = f"{date.today().year}-{date.today().month:02d}"
        data = compute_monthly_report(db, user.household_id, month)
    if not data:
        raise HTTPException(status_code=400, detail="Pas encore assez de données pour générer un bilan.")
    ok = send_monthly_report(db, user.household_id, month)
    if not ok:
        raise HTTPException(status_code=502, detail="Envoi impossible (email non configuré ?). Réessayez plus tard.")
    return {"sent": True, "month": month, "to": user.email}


@router.post("/cron/send-monthly")
def cron_send_monthly(
    x_cron_secret: str = Header(None, alias="X-Cron-Secret"),
    db: Session = Depends(get_db),
):
    """Trigger mensuel (Railway cron, début de mois). Envoie le bilan du mois
    écoulé à chaque foyer ayant activé l'option."""
    if not settings.CRON_SECRET or not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")

    month = last_completed_month()
    # households est hors RLS → liste OK sans contexte.
    households = db.query(Household).filter(Household.monthly_report_enabled == True).all()  # noqa: E712
    sent = 0
    for hh in households:
        try:
            # Pose le contexte RLS pour ce foyer (transaction-scoped).
            db.execute(text("SELECT set_config('app.current_household_id', :h, true)"), {"h": hh.id})
            if send_monthly_report(db, hh.id, month):
                sent += 1
        except Exception as e:
            logger.warning("Bilan mensuel échoué pour foyer %s : %s", hh.id, e)
    return {"month": month, "households_optin": len(households), "emails_sent": sent}

"""
AI insights endpoint — Coach patrimoine + Alertes intelligentes.

POST /ai/insights
  - Reçoit un snapshot financier dont TOUS les chiffres sont calculés côté
    frontend (net worth, taux d'épargne, top catégories vs moyenne, charges
    récurrentes non débitées, creux de projection…) + une liste de signaux
    d'alerte déjà détectés (avec montants exacts).
  - Appelle Claude Haiku UNE fois pour : (a) rédiger 2-3 observations "coach"
    en langage naturel, (b) prioriser/reformuler les alertes.
  - L'IA ne fait QUE de la synthèse/formulation à partir des chiffres fournis —
    elle n'invente aucun montant (consigne stricte + on ne lui envoie pas les
    transactions brutes).
  - Dégradation propre : si ANTHROPIC_API_KEY absente ou erreur API, renvoie
    un fallback déterministe construit depuis le snapshot.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.config import settings
from app.rate_limit import limiter

router = APIRouter(prefix="/ai", tags=["ai"])


# ---- Schémas ----------------------------------------------------------------
class CategorySignal(BaseModel):
    name: str
    amount: float
    avg3m: Optional[float] = None  # moyenne des 3 mois précédents


class AlertSignal(BaseModel):
    kind: str                      # 'category_spike' | 'recurring_unpaid' | 'savings_drop' | 'low_runway'
    severity: str = "info"         # 'info' | 'warn'
    label: str
    amount: Optional[float] = None
    detail: Optional[str] = None


class InsightsRequest(BaseModel):
    currency: str = "EUR"
    net_worth: Optional[float] = None
    liquid_wealth: Optional[float] = None
    savings_rate_pct: Optional[float] = None
    month_income: Optional[float] = None
    month_expenses: Optional[float] = None
    month_savings: Optional[float] = None
    top_categories: list[CategorySignal] = Field(default_factory=list)
    alert_signals: list[AlertSignal] = Field(default_factory=list)
    projection_trough_amount: Optional[float] = None
    projection_trough_date: Optional[str] = None


class CoachItem(BaseModel):
    title: str
    body: str


class AlertItem(BaseModel):
    severity: str = "info"
    text: str


class InsightsResponse(BaseModel):
    coach: list[CoachItem] = Field(default_factory=list)
    alerts: list[AlertItem] = Field(default_factory=list)
    ai_used: bool = False
    ai_available: bool = False


def _fmt_eur(v: Optional[float]) -> str:
    if v is None:
        return "—"
    return f"{v:,.0f} €".replace(",", " ")


def _deterministic_fallback(req: InsightsRequest) -> InsightsResponse:
    """Construit coach + alertes sans IA, à partir des chiffres fournis."""
    coach: list[CoachItem] = []
    if req.savings_rate_pct is not None:
        if req.savings_rate_pct >= 20:
            coach.append(CoachItem(
                title="Épargne solide",
                body=f"Tu épargnes {req.savings_rate_pct:.0f} % de tes revenus ce mois-ci — au-dessus du repère des 20 %. Continue sur cette lancée.",
            ))
        elif req.savings_rate_pct >= 0:
            coach.append(CoachItem(
                title="Marge d'épargne",
                body=f"Ton taux d'épargne est de {req.savings_rate_pct:.0f} % ce mois-ci. Viser 20 % renforcerait ton coussin de sécurité.",
            ))
        else:
            coach.append(CoachItem(
                title="Mois déficitaire",
                body="Tes dépenses dépassent tes revenus ce mois-ci. Regarde les postes les plus élevés pour rééquilibrer.",
            ))
    if req.net_worth is not None:
        coach.append(CoachItem(
            title="Patrimoine net",
            body=f"Ton patrimoine net s'élève à {_fmt_eur(req.net_worth)}.",
        ))
    alerts = [AlertItem(severity=s.severity, text=s.label) for s in req.alert_signals]
    return InsightsResponse(coach=coach[:3], alerts=alerts, ai_used=False, ai_available=False)


@router.post("/insights", response_model=InsightsResponse)
@limiter.limit("60/day")
def ai_insights(
    payload: InsightsRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_available = bool(settings.ANTHROPIC_API_KEY)
    if not ai_available:
        return _deterministic_fallback(payload)

    try:
        return _insights_with_claude(payload)
    except Exception:
        # Jamais d'erreur 500 au client pour un panneau secondaire — fallback.
        fb = _deterministic_fallback(payload)
        fb.ai_available = True
        return fb


def _insights_with_claude(req: InsightsRequest) -> InsightsResponse:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    snapshot = {
        "devise": req.currency,
        "patrimoine_net": req.net_worth,
        "patrimoine_liquide": req.liquid_wealth,
        "taux_epargne_pct": req.savings_rate_pct,
        "revenus_mois": req.month_income,
        "depenses_mois": req.month_expenses,
        "epargne_mois": req.month_savings,
        "top_categories": [
            {"nom": c.name, "montant": c.amount, "moyenne_3m": c.avg3m}
            for c in req.top_categories
        ],
        "creux_projection": (
            {"montant": req.projection_trough_amount, "date": req.projection_trough_date}
            if req.projection_trough_amount is not None else None
        ),
        "signaux_alertes": [
            {"type": a.kind, "gravite": a.severity, "libelle": a.label,
             "montant": a.amount, "detail": a.detail}
            for a in req.alert_signals
        ],
    }

    prompt = f"""Tu es le coach financier de Wealthly, une app de gestion de patrimoine familial française.
Ton ton est sobre, bienveillant, concret — jamais alarmiste ni racoleur. Tutoiement.

Voici un instantané chiffré du foyer (tous les montants sont en {req.currency}) :
{json.dumps(snapshot, ensure_ascii=False, indent=2)}

Règles ABSOLUES :
- N'invente AUCUN chiffre. Utilise uniquement les montants présents ci-dessus.
- Si une donnée est null, ne l'évoque pas.
- Sois bref : phrases courtes, pas de jargon.

Produis 2 à 3 observations "coach" (synthèse utile, 1 phrase chacune) et reformule
les signaux d'alerte fournis en messages clairs (garde leurs montants exacts).

Réponds UNIQUEMENT avec un objet JSON valide de cette forme, sans texte autour :
{{
  "coach": [{{"title": "Titre court", "body": "Une phrase."}}],
  "alerts": [{{"severity": "info|warn", "text": "Message avec le montant exact."}}]
}}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if "```" in raw:
        # Extrait le bloc entre les premières fences
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw.strip())

    coach = [CoachItem(title=str(c.get("title", "")), body=str(c.get("body", "")))
             for c in data.get("coach", []) if c.get("body")]
    alerts = [AlertItem(severity=str(a.get("severity", "info")), text=str(a.get("text", "")))
              for a in data.get("alerts", []) if a.get("text")]
    return InsightsResponse(coach=coach[:3], alerts=alerts, ai_used=True, ai_available=True)

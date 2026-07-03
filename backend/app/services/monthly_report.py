"""
Bilan mensuel automatique — calcul serveur + rendu HTML email.

Source des chiffres (100 % serveur, aucune dépendance au frontend) :
  - WealthSnapshot (mois courant vs précédent) → patrimoine net + delta + alloc.
  - Transaction du mois → revenus / dépenses / épargne + top catégories.
  - FixedCharge → reste à vivre (revenus − charges fixes actives).

Le HTML est porté de la maquette validée `yotori-bilan-email.html`
(email-safe : styles inline, pas de SVG, barre d'allocation empilée).

Aucune exception ne remonte : un foyer sans données est simplement ignoré
(retourne None), pour que le cron mensuel n'échoue jamais en bloc.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    WealthSnapshot, Transaction, Category, FixedCharge, User, Household,
)
from app.email_service import send_email
from app.config import settings

logger = logging.getLogger("yotori.report")

_FR_MONTHS = [
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]
# Palette dataviz (cohérente avec le front / PDF).
_ALLOC_COLORS = ["#2540D9", "#1F8E6E", "#C2733B", "#7B57C6"]
_BAR_COLOR = "#2540D9"


def _mk(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def _prev_mk(mk: str) -> str:
    y, m = map(int, mk.split("-"))
    return f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"


def last_completed_month() -> str:
    """Le mois écoulé (mois précédent le mois courant)."""
    return _prev_mk(_mk(date.today()))


def _month_long(mk: str) -> str:
    y, m = mk.split("-")
    return f"{_FR_MONTHS[int(m)]} {y}"


def _eur(v: Optional[float], sign: bool = False) -> str:
    if v is None:
        return "—"
    s = f"{abs(v):,.0f}".replace(",", " ") + " €"
    if v < 0:
        return f"−{s}"
    if sign and v > 0:
        return f"+{s}"
    return s


def _coach_line(savings_rate, delta_pct, net_worth) -> str:
    if savings_rate is not None and savings_rate >= 20:
        return (f"Beau mois : vous avez épargné <b>{savings_rate:.0f} %</b> de vos revenus, "
                f"au-dessus du repère des 20 %. Continuez sur cette lancée.")
    if savings_rate is not None and savings_rate >= 0:
        return (f"Votre taux d'épargne est de <b>{savings_rate:.0f} %</b> ce mois-ci. "
                f"Viser 20 % renforcerait votre coussin de sécurité.")
    if savings_rate is not None:
        return ("Mois déficitaire : vos dépenses ont dépassé vos revenus. "
                "Regardez les postes les plus élevés pour rééquilibrer.")
    if delta_pct is not None and delta_pct > 0:
        return f"Votre patrimoine net progresse de <b>{delta_pct:.1f} %</b> ce mois-ci."
    return "Voici votre bilan du mois — un coup d'œil rapide sur vos finances."


def compute_monthly_report(db: Session, household_id: str, month: str) -> Optional[dict]:
    """Agrège les chiffres du bilan. Retourne None si rien à montrer."""
    snap = db.query(WealthSnapshot).filter_by(household_id=household_id, month=month).first()
    prev = db.query(WealthSnapshot).filter_by(household_id=household_id, month=_prev_mk(month)).first()

    net_worth = snap.net_worth if snap else None
    delta = (snap.net_worth - prev.net_worth) if (snap and prev) else None
    delta_pct = (delta / prev.net_worth * 100) if (delta is not None and prev and prev.net_worth) else None

    cats = db.query(Category).filter(Category.household_id == household_id).all()
    cat_by_id = {c.id: c for c in cats}
    name_by_slug = {c.slug: c.name for c in cats}

    def is_transfer(t: Transaction) -> bool:
        if t.is_transfer_override is True:
            return True
        c = cat_by_id.get(t.category_id)
        return bool(c and c.type == "transfer")

    txs = db.query(Transaction).filter(Transaction.household_id == household_id).all()
    month_txs = [t for t in txs if _mk(t.date) == month]

    income = sum(float(t.amount) for t in month_txs if t.amount > 0 and not is_transfer(t))
    expenses = sum(-float(t.amount) for t in month_txs if t.amount < 0 and not is_transfer(t))
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else None

    # Top dépenses, roulées au niveau catégorie parente.
    by_cat: dict[str, float] = defaultdict(float)
    for t in month_txs:
        if t.amount >= 0 or is_transfer(t):
            continue
        c = cat_by_id.get(t.category_id)
        if c is None:
            label = "Non catégorisé"
        else:
            label = name_by_slug.get(c.parent_slug, c.name) if c.parent_slug else c.name
        by_cat[label] += -float(t.amount)
    top = sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)[:4]

    # Allocation depuis le snapshot.
    alloc: list[tuple[str, float]] = []
    if snap:
        immo_net = (snap.real_estate_value or 0) - (snap.mortgage_debt or 0)
        liquid = snap.liquid_wealth or 0
        placements = (snap.financial_assets_value or 0) - liquid
        if immo_net > 0:
            alloc.append(("Immobilier net", immo_net))
        if placements > 0:
            alloc.append(("Placements", placements))
        if liquid > 0:
            alloc.append(("Liquidités", liquid))

    # Reste à vivre : revenus − charges fixes (kind=expense) actives ce mois.
    fixed_total = 0.0
    for fc in db.query(FixedCharge).filter(FixedCharge.household_id == household_id).all():
        if (fc.kind or "expense") != "expense":
            continue
        if fc.start_month and month < fc.start_month:
            continue
        if fc.end_month and month > fc.end_month:
            continue
        fixed_total += float(fc.amount or 0)
    reste = (income - fixed_total) if income > 0 else None

    # Rien d'exploitable → on n'envoie pas.
    if net_worth is None and income == 0 and expenses == 0:
        return None

    return {
        "month": month,
        "month_long": _month_long(month),
        "net_worth": net_worth,
        "delta": delta,
        "delta_pct": delta_pct,
        "income": income,
        "expenses": expenses,
        "savings": savings,
        "savings_rate": savings_rate,
        "reste": reste,
        "top": top,
        "alloc": alloc,
        "coach": _coach_line(savings_rate, delta_pct, net_worth),
    }


def render_html(data: dict, user_name: str) -> str:
    """Porte la maquette `yotori-bilan-email.html` avec les chiffres réels."""
    fe = settings.FRONTEND_URL.rstrip("/")
    month_long = data["month_long"]

    # Delta badge
    if data["delta"] is not None:
        pos = data["delta"] >= 0
        bg, fg = ("#E1EFE6", "#136D3E") if pos else ("#F6E4E1", "#B0392B")
        pct = f" · {'+' if pos else '−'}{abs(data['delta_pct']):.1f} %" if data["delta_pct"] is not None else ""
        delta_html = (f'<div style="display:inline-block;padding:5px 13px;border-radius:999px;'
                      f'font-size:13px;font-weight:600;background:{bg};color:{fg};">'
                      f'{_eur(data["delta"], sign=True)}{pct} ce mois-ci</div>')
    else:
        delta_html = ""

    # KPI cards
    saved_val = _eur(data["savings"], sign=True)
    saved_color = "#136D3E" if (data["savings"] or 0) >= 0 else "#B0392B"
    rate_sub = f"taux d'épargne {data['savings_rate']:.0f} %" if data["savings_rate"] is not None else "ce mois-ci"
    reste_val = _eur(data["reste"]) if data["reste"] is not None else "—"

    # Top dépenses
    max_exp = data["top"][0][1] if data["top"] else 1
    rows = ""
    for i, (name, amt) in enumerate(data["top"], start=1):
        width = max(4, round(amt / max_exp * 100))
        rows += (
            f'<div style="display:flex;align-items:center;justify-content:space-between;'
            f'padding:9px 0;border-bottom:1px solid #efede6;font-size:13.5px;">'
            f'<span><span style="display:inline-block;width:20px;color:#8c8979;">{i}.</span>'
            f'<span style="color:#56544a;">{name}</span></span>'
            f'<span style="font-weight:600;color:#16150f;">{_eur(amt)}</span></div>'
            f'<div style="height:6px;border-radius:3px;background:#EFEDE6;margin-top:5px;overflow:hidden;">'
            f'<span style="display:block;height:100%;width:{width}%;background:{_BAR_COLOR};border-radius:3px;"></span></div>'
        )
    top_section = ""
    if rows:
        top_section = (
            f'<div style="padding:24px 32px;border-bottom:1px solid #efede6;">'
            f'<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c8979;'
            f'font-weight:600;margin-bottom:14px;">Où est parti votre argent</div>{rows}</div>'
        )

    # Allocation
    alloc_section = ""
    if data["alloc"]:
        total = sum(v for _, v in data["alloc"]) or 1
        segs = ""
        legend = ""
        for i, (name, val) in enumerate(data["alloc"]):
            color = _ALLOC_COLORS[i % len(_ALLOC_COLORS)]
            w = round(val / total * 100, 1)
            segs += f'<span style="display:block;height:100%;width:{w}%;background:{color};"></span>'
            legend += (f'<span style="display:inline-block;margin-right:14px;">'
                       f'<span style="display:inline-block;width:9px;height:9px;border-radius:2px;'
                       f'background:{color};margin-right:5px;"></span>{name} <b style="color:#16150f;">{_eur(val)}</b></span>')
        alloc_section = (
            f'<div style="padding:24px 32px;border-bottom:1px solid #efede6;">'
            f'<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c8979;'
            f'font-weight:600;margin-bottom:14px;">Composition du patrimoine</div>'
            f'<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin-bottom:12px;">{segs}</div>'
            f'<div style="font-size:12px;color:#56544a;">{legend}</div></div>'
        )

    nw_block = ""
    if data["net_worth"] is not None:
        nw_block = (
            f'<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c8979;font-weight:600;">Patrimoine net</div>'
            f'<div style="font-family:Georgia,serif;font-style:italic;font-weight:500;font-size:46px;line-height:1;color:#16150f;margin:8px 0 10px;">{_eur(data["net_worth"])}</div>'
            f'{delta_html}'
        )

    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#d9d7cf;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:24px 12px;">
<div style="max-width:600px;margin:0 auto;background:#F7F6F2;border:1px solid #e4e1d8;border-radius:12px;overflow:hidden;">

  <div style="background:#FFFFFF;padding:32px 32px 26px;border-bottom:1px solid #efede6;text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;">
      <span style="width:26px;height:26px;border-radius:7px;background:#16150f;color:#F7F6F2;font-weight:700;font-size:14px;display:inline-flex;align-items:center;justify-content:center;">W</span>
      <span style="font-weight:600;font-size:15px;color:#16150f;">Yotori Finance</span>
    </div>
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8c8979;font-weight:600;">Bilan de {month_long}</div>
    <div style="margin:8px 0 18px;font-size:24px;font-weight:600;color:#16150f;">Bonjour <span style="font-family:Georgia,serif;font-style:italic;">{user_name}.</span></div>
    {nw_block}
  </div>

  <div style="padding:24px 32px;border-bottom:1px solid #efede6;">
    <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c8979;font-weight:600;margin-bottom:14px;">Ton mois en chiffres</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="50%" style="vertical-align:top;padding-right:6px;">
        <div style="border:1px solid #e4e1d8;border-radius:10px;padding:16px 18px;background:#fff;">
          <div style="font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#8c8979;font-weight:600;">Épargné ce mois</div>
          <div style="font-size:24px;font-weight:600;color:{saved_color};margin-top:6px;">{saved_val}</div>
          <div style="font-size:11.5px;color:#8c8979;margin-top:3px;">{rate_sub}</div>
        </div>
      </td>
      <td width="50%" style="vertical-align:top;padding-left:6px;">
        <div style="border:1px solid #e4e1d8;border-radius:10px;padding:16px 18px;background:#fff;">
          <div style="font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#8c8979;font-weight:600;">Reste à vivre</div>
          <div style="font-size:24px;font-weight:600;color:#16150f;margin-top:6px;">{reste_val}</div>
          <div style="font-size:11.5px;color:#8c8979;margin-top:3px;">après charges fixes</div>
        </div>
      </td>
    </tr></table>
  </div>

  <div style="margin:0 32px 24px;padding:16px 18px;border-radius:12px;background:#E7EBFF;border:1px solid rgba(37,64,217,.18);">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:top;padding-right:12px;"><span style="display:inline-block;width:32px;height:32px;border-radius:9px;background:#2540D9;color:#fff;text-align:center;line-height:32px;font-size:16px;">✦</span></td>
      <td style="font-size:13.5px;line-height:1.5;color:#16150f;">{data["coach"]}</td>
    </tr></table>
  </div>

  {top_section}
  {alloc_section}

  <div style="padding:28px 32px;text-align:center;">
    <a href="{fe}" style="display:inline-block;background:#16150f;color:#F7F6F2;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:8px;">Voir le détail dans Yotori Finance →</a>
  </div>

  <div style="padding:22px 32px 28px;text-align:center;font-size:11.5px;color:#8c8979;line-height:1.6;">
    Vous recevez ce bilan car vous l'avez activé dans vos réglages.<br>
    <a href="{fe}/#/settings" style="color:#8c8979;text-decoration:underline;">Gérer mes notifications</a><br>
    Yotori Finance — votre patrimoine, piloté avec rigueur.
  </div>
</div></body></html>"""


def send_monthly_report(db: Session, household_id: str, month: Optional[str] = None) -> bool:
    """Calcule + envoie le bilan du mois à l'email du 1er utilisateur du foyer."""
    month = month or last_completed_month()
    user = db.query(User).filter(User.household_id == household_id).first()
    if not user or not user.email:
        return False
    data = compute_monthly_report(db, household_id, month)
    if not data:
        logger.info("Bilan %s ignoré (foyer %s : pas de données).", month, household_id)
        return False
    name = (getattr(user, "full_name", None) or "").strip() or user.email.split("@")[0]
    subject = f"Ton bilan de {data['month_long']}"
    if data["delta_pct"] is not None:
        subject += f" — patrimoine {'+' if data['delta'] >= 0 else '−'}{abs(data['delta_pct']):.1f} %"
    html = render_html(data, name)
    return send_email(user.email, subject, html)

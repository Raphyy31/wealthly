"""
Moteur d'alertes intelligentes — détection idempotente.

Tourne sur demande (refresh à l'ouverture de l'app) et pourra tourner sur cron
pour les emails. Chaque alerte porte une `dedup_key` stable par foyer : re-scanner
ne crée JAMAIS de doublon. Les seuils sont volontairement CONSERVATEURS — une
fausse alerte détruit la confiance, mieux vaut en rater une que crier au loup.

Tous les chiffres sont calculés ici (déterministe). Aucune dépendance IA.
"""
from datetime import date, timedelta
from collections import defaultdict
from calendar import monthrange

from sqlalchemy.orm import Session

from app.models import Notification, Transaction, FixedCharge, Budget, Account, Category


def _mk(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def _norm_label(label: str) -> str:
    return (label or '').strip().upper()[:14]


def run_detection(db: Session, household_id: str) -> int:
    """Détecte, déduplique, persiste. Retourne le nombre de NOUVELLES alertes."""
    today = date.today()
    cur_month = _mk(today)

    txs = db.query(Transaction).filter(Transaction.household_id == household_id).all()
    accounts = db.query(Account).filter(Account.household_id == household_id).all()
    charges = db.query(FixedCharge).filter(FixedCharge.household_id == household_id).all()
    budgets = db.query(Budget).filter(Budget.household_id == household_id).all()
    cats = db.query(Category).filter(Category.household_id == household_id).all()
    id_to_slug = {c.id: c.slug for c in cats}
    slug_to_name = {c.slug: c.name for c in cats}

    found: list[dict] = []
    found += _detect_low_balance(accounts, txs)
    found += _detect_budget_overrun(today, cur_month, txs, budgets, id_to_slug, slug_to_name)
    found += _detect_fixed_charge_unpaid(today, cur_month, txs, charges)
    found += _detect_duplicate(today, txs)
    found += _detect_unusual_debit(today, txs)
    found += _detect_subscription_hike(txs)

    created = 0
    for n in found:
        exists = db.query(Notification).filter(
            Notification.household_id == household_id,
            Notification.dedup_key == n['dedup_key'],
        ).first()
        if exists:
            continue
        db.add(Notification(household_id=household_id, status='unread', **n))
        created += 1
    if created:
        db.commit()
    return created


# --- Détecteurs ------------------------------------------------------------

def _acct_balance(acct, txs_by_acct) -> float:
    if acct.last_known_balance is not None:
        return float(acct.last_known_balance)
    base = float(acct.initial_balance or 0)
    return base + sum(float(t.amount) for t in txs_by_acct.get(acct.id, []))


def _detect_low_balance(accounts, txs) -> list[dict]:
    by_acct = defaultdict(list)
    for t in txs:
        by_acct[t.account_id].append(t)
    out = []
    for a in accounts:
        if (a.role or 'principal') not in ('principal', 'depenses'):
            continue
        bal = _acct_balance(a, by_acct)
        if bal < 0:
            out.append({
                'dedup_key': f"low_balance:{a.id}:{_mk(date.today())}",
                'kind': 'low_balance', 'severity': 'critical',
                'title': 'Découvert sur un compte',
                'body': f"{a.name} est à découvert ({bal:,.0f} €).".replace(',', ' '),
                'data': {'account_id': a.id, 'balance': round(bal, 2)},
                'link': 'dashboard',
            })
    return out


def _detect_budget_overrun(today, cur_month, txs, budgets, id_to_slug, slug_to_name) -> list[dict]:
    if not budgets:
        return []
    dim = monthrange(today.year, today.month)[1]
    elapsed = max(0.05, today.day / dim)
    spend = defaultdict(float)
    for t in txs:
        if t.amount < 0 and _mk(t.date) == cur_month:
            slug = id_to_slug.get(t.category_id, 'uncategorized')
            spend[slug] += -float(t.amount)
    out = []
    for b in budgets:
        if b.amount <= 0:
            continue
        spent = spend.get(b.category_slug, 0)
        name = slug_to_name.get(b.category_slug, b.category_slug)
        if spent > b.amount:
            out.append({
                'dedup_key': f"budget_overrun:{b.category_slug}:{cur_month}",
                'kind': 'budget_overrun', 'severity': 'warn',
                'title': f"Budget {name} dépassé",
                'body': f"{spent:,.0f} € dépensés ce mois-ci sur un budget de {b.amount:,.0f} €.".replace(',', ' '),
                'data': {'category': b.category_slug, 'spent': round(spent, 2), 'budget': b.amount},
                'link': 'monthly',
            })
        elif elapsed >= 0.30 and (spent / elapsed) > b.amount * 1.05:
            proj = spent / elapsed
            out.append({
                'dedup_key': f"budget_proj:{b.category_slug}:{cur_month}",
                'kind': 'budget_overrun', 'severity': 'info',
                'title': f"Budget {name} en passe d'être dépassé",
                'body': f"À ce rythme tu finirais le mois à ~{proj:,.0f} €, au-dessus de ton budget de {b.amount:,.0f} €.".replace(',', ' '),
                'data': {'category': b.category_slug, 'projected': round(proj, 2), 'budget': b.amount},
                'link': 'monthly',
            })
    return out


def _detect_fixed_charge_unpaid(today, cur_month, txs, charges) -> list[dict]:
    month_debits = [abs(float(t.amount)) for t in txs if t.amount < 0 and _mk(t.date) == cur_month]
    out = []
    for c in charges:
        if (c.kind or 'expense') == 'income':
            continue
        if not c.day_of_month:
            continue
        # active ce mois-ci ?
        if c.start_month and cur_month < c.start_month:
            continue
        if c.end_month and cur_month > c.end_month:
            continue
        # l'échéance est passée depuis > 5 jours ?
        if today.day <= c.day_of_month + 5:
            continue
        amt = float(c.amount or 0)
        if amt <= 0:
            continue
        tol = max(5.0, 0.12 * amt)
        matched = any(abs(d - amt) <= tol for d in month_debits)
        if not matched:
            out.append({
                'dedup_key': f"fixed_unpaid:{c.id}:{cur_month}",
                'kind': 'fixed_charge_unpaid', 'severity': 'warn',
                'title': f"{c.name} pas encore débité",
                'body': f"Prévu le {c.day_of_month} du mois (~{amt:,.0f} €), aucun débit correspondant ce mois-ci.".replace(',', ' '),
                'data': {'charge_id': c.id, 'amount': amt, 'day': c.day_of_month},
                'link': 'monthly',
            })
    return out


def _detect_duplicate(today, txs) -> list[dict]:
    cutoff = today - timedelta(days=30)
    recent = [t for t in txs if t.amount < 0 and t.date >= cutoff]
    groups = defaultdict(list)
    for t in recent:
        groups[(t.account_id, round(float(t.amount), 2))].append(t)
    out = []
    seen = set()
    for (_acc, _amt), items in groups.items():
        if len(items) < 2:
            continue
        items.sort(key=lambda t: t.date)
        for i in range(len(items) - 1):
            a, b = items[i], items[i + 1]
            gap = (b.date - a.date).days
            same_label = _norm_label(a.label) == _norm_label(b.label) or (a.payee_id and a.payee_id == b.payee_id)
            if gap <= 3 and same_label:
                key_ids = ':'.join(sorted([a.id, b.id]))
                if key_ids in seen:
                    continue
                seen.add(key_ids)
                out.append({
                    'dedup_key': f"duplicate:{key_ids}",
                    'kind': 'duplicate_charge', 'severity': 'warn',
                    'title': 'Doublon possible',
                    'body': f"« {a.label} » a été débité 2× ({abs(float(a.amount)):,.0f} €) à {gap} jour(s) d'intervalle.".replace(',', ' '),
                    'data': {'tx_ids': [a.id, b.id], 'amount': round(abs(float(a.amount)), 2)},
                    'link': 'transactions',
                })
    return out


def _detect_unusual_debit(today, txs) -> list[dict]:
    cutoff_recent = today - timedelta(days=14)
    debits = [t for t in txs if t.amount < 0]
    hist = defaultdict(list)  # label -> [amounts] (older than 14j)
    for t in debits:
        if t.date < cutoff_recent:
            hist[_norm_label(t.label)].append(abs(float(t.amount)))
    out = []
    for t in debits:
        if t.date < cutoff_recent:
            continue
        key = _norm_label(t.label)
        samples = hist.get(key, [])
        if len(samples) < 3:
            continue
        avg = sum(samples) / len(samples)
        amt = abs(float(t.amount))
        if avg > 0 and amt > avg * 2.5 and (amt - avg) > 80:
            out.append({
                'dedup_key': f"unusual_debit:{t.id}",
                'kind': 'unusual_debit', 'severity': 'warn',
                'title': 'Dépense inhabituelle',
                'body': f"« {t.label} » : {amt:,.0f} € le {t.date.isoformat()}, soit ~{amt / avg:.1f}× ta moyenne habituelle (~{avg:,.0f} €).".replace(',', ' '),
                'data': {'tx_id': t.id, 'amount': round(amt, 2), 'avg': round(avg, 2)},
                'link': 'transactions',
            })
    return out


def _detect_subscription_hike(txs) -> list[dict]:
    """Conservateur : un même libellé, ~mensuel, ≥3 occurrences stables, puis un
    saut net du dernier montant. Évite les faux positifs sur dépenses variables."""
    by_label = defaultdict(list)
    for t in txs:
        if t.amount < 0:
            by_label[_norm_label(t.label)].append(t)
    out = []
    for key, items in by_label.items():
        if len(items) < 4:
            continue
        items.sort(key=lambda t: t.date)
        amounts = [abs(float(t.amount)) for t in items]
        prior = amounts[:-1]
        last = amounts[-1]
        base = sum(prior) / len(prior)
        # faible variance sur l'historique (abonnement, pas dépense variable)
        if base <= 0:
            continue
        spread = (max(prior) - min(prior)) / base
        if spread > 0.10:
            continue
        if last > base * 1.10 and (last - base) >= 3:
            out.append({
                'dedup_key': f"sub_hike:{key}:{round(last)}",
                'kind': 'subscription_hike', 'severity': 'info',
                'title': 'Abonnement en hausse',
                'body': f"« {items[-1].label} » est passé de ~{base:,.0f} € à {last:,.0f} € (+{(last / base - 1) * 100:.0f} %).".replace(',', ' '),
                'data': {'label': items[-1].label, 'old': round(base, 2), 'new': round(last, 2)},
                'link': 'transactions',
            })
    return out

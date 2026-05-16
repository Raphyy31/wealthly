"""
Transactions endpoints: list, create one, bulk import (with deduplication),
update category/notes, delete.
"""
from typing import List, Optional
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models import User, Transaction, Account, Category
from app.defaults import DEFAULT_CATEGORIES
from app.schemas import (
    TransactionCreate, TransactionUpdate, TransactionOut,
    TransactionImport, TransactionImportResult,
)
from app.auth import get_current_user
from app.categorization import categorize_transaction
from app.categorization.learning import on_transaction_recategorized

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _make_dedup_hash(account_id: str, dt: date_type, amount: float, label: str) -> str:
    """Hash used to deduplicate imports — must match frontend's hashTransaction logic."""
    label_part = (label or "")[:50].lower().strip()
    return f"{account_id}|{dt.isoformat()}|{amount:.2f}|{label_part}"


_DEFAULT_CAT_BY_SLUG = {c["slug"]: c for c in DEFAULT_CATEGORIES}


def _resolve_category_id(db: Session, household_id: str, slug: Optional[str]) -> Optional[str]:
    if not slug:
        return None
    cat = db.query(Category).filter(
        Category.household_id == household_id,
        Category.slug == slug,
    ).first()
    if cat:
        return cat.id
    # Lazy-seed: if this slug exists in DEFAULT_CATEGORIES but the household
    # is missing it (legacy account or partial seed), create it now so the
    # import doesn't silently lose the category.
    default = _DEFAULT_CAT_BY_SLUG.get(slug)
    if default:
        cat = Category(household_id=household_id, **default)
        db.add(cat)
        db.flush()
        return cat.id
    return None


def _to_out(tx: Transaction, db: Session) -> dict:
    cat_slug = None
    if tx.category_id:
        cat = db.query(Category).filter(Category.id == tx.category_id).first()
        cat_slug = cat.slug if cat else None
    payee_name = None
    if tx.payee_id:
        from app.models import Payee  # local import to avoid circular
        p = db.query(Payee).filter(Payee.id == tx.payee_id).first()
        payee_name = p.name if p else None
    return {
        "id": tx.id,
        "account_id": tx.account_id,
        "date": tx.date,
        "label": tx.label,
        "amount": tx.amount,
        "category_slug": cat_slug,
        "is_manual_category": tx.is_manual_category,
        "is_recurring_override": tx.is_recurring_override,
        "is_transfer_override": tx.is_transfer_override,
        "notes": tx.notes or "",
        "tags": tx.tags or [],
        "household_id": tx.household_id,
        "payee_id": tx.payee_id,
        "payee_name": payee_name,
        "cat_source": tx.cat_source,
    }


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    account_id: Optional[str] = Query(None),
    limit: int = Query(5000, ge=1, le=20000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all transactions for the current household, optionally filtered by account."""
    q = db.query(Transaction).filter(Transaction.household_id == user.household_id)
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    txs = q.order_by(Transaction.date.desc()).limit(limit).all()
    return [_to_out(t, db) for t in txs]


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Add a single transaction (manual entry)."""
    # Verify account belongs to user's household
    acc = db.query(Account).filter(
        Account.id == payload.account_id,
        Account.household_id == user.household_id,
    ).first()
    if not acc:
        raise HTTPException(status_code=400, detail="Compte invalide")

    cat_id = _resolve_category_id(db, user.household_id, payload.category_slug)
    dedup = _make_dedup_hash(payload.account_id, payload.date, payload.amount, payload.label)

    # Reject duplicates
    existing = db.query(Transaction).filter(
        Transaction.household_id == user.household_id,
        Transaction.dedup_hash == dedup,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Transaction déjà existante (doublon)")

    tx = Transaction(
        household_id=user.household_id,
        account_id=payload.account_id,
        date=payload.date,
        label=payload.label,
        amount=payload.amount,
        category_id=cat_id,
        is_manual_category=payload.is_manual_category,
        is_recurring_override=payload.is_recurring_override,
        is_transfer_override=payload.is_transfer_override,
        notes=payload.notes or "",
        tags=payload.tags or [],
        dedup_hash=dedup,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return _to_out(tx, db)


@router.post("/import", response_model=TransactionImportResult, status_code=201)
def bulk_import(payload: TransactionImport, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Import a batch of transactions. Skips duplicates (same account+date+amount+label).
    This is what the React frontend calls after parsing a CSV."""
    acc = db.query(Account).filter(
        Account.id == payload.account_id,
        Account.household_id == user.household_id,
    ).first()
    if not acc:
        raise HTTPException(status_code=400, detail="Compte invalide")

    # Pre-fetch existing dedup hashes to avoid N+1 queries
    existing_hashes = set(
        h for (h,) in db.query(Transaction.dedup_hash).filter(
            Transaction.household_id == user.household_id,
        ).all()
    )

    inserted = 0
    skipped = 0
    for t in payload.transactions:
        dedup = _make_dedup_hash(payload.account_id, t.date, t.amount, t.label)
        if dedup in existing_hashes:
            skipped += 1
            continue
        # Si le client n'a pas pré-catégorisé (slug fourni explicitement), on
        # passe par le moteur Payees + builtin rules pour assigner cat + payee
        # + flag transfer côté backend, source de vérité.
        cat_id = None
        payee_id_resolved = None
        cat_source = None
        is_transfer_auto = t.is_transfer_override
        if t.category_slug:
            cat_id = _resolve_category_id(db, user.household_id, t.category_slug)
            cat_source = "user_rule" if t.is_manual_category else None
        else:
            result = categorize_transaction(
                label=t.label, amount=t.amount, household_id=user.household_id, db=db, date=t.date,
            )
            if result.slug:
                cat_id = _resolve_category_id(db, user.household_id, result.slug)
            payee_id_resolved = result.payee_id
            cat_source = result.source
            if result.is_transfer and is_transfer_auto is None:
                is_transfer_auto = True

        tx = Transaction(
            household_id=user.household_id,
            account_id=payload.account_id,
            date=t.date,
            label=t.label,
            amount=t.amount,
            category_id=cat_id,
            payee_id=payee_id_resolved,
            cat_source=cat_source,
            is_manual_category=t.is_manual_category,
            is_recurring_override=t.is_recurring_override,
            is_transfer_override=is_transfer_auto,
            notes=t.notes or "",
            tags=t.tags or [],
            dedup_hash=dedup,
        )
        db.add(tx)
        existing_hashes.add(dedup)  # avoid duplicates within the same batch
        inserted += 1

    db.commit()
    return TransactionImportResult(inserted=inserted, skipped_duplicates=skipped)


@router.put("/{tx_id}")
def update_transaction(tx_id: str, payload: TransactionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.household_id == user.household_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")
    data = payload.model_dump(exclude_unset=True)
    cat_changed_to: Optional[str] = None
    if "category_slug" in data:
        cat_slug = data.pop("category_slug")
        tx.category_id = _resolve_category_id(db, user.household_id, cat_slug)
        cat_changed_to = tx.category_id
    for k, v in data.items():
        setattr(tx, k, v)
    db.commit()
    db.refresh(tx)
    # Hook Category Learning : si l'user a recatégorisé manuellement et que
    # le payee est connu, on peut auto-créer une règle apprise après seuil.
    learned_rule = None
    if cat_changed_to and tx.is_manual_category and tx.payee_id:
        try:
            learned_rule = on_transaction_recategorized(
                tx=tx, new_category_id=cat_changed_to,
                household_id=user.household_id, db=db,
            )
        except Exception:
            pass  # ne bloque jamais l'update
    out = _to_out(tx, db)
    if learned_rule:
        out["learned_rule"] = learned_rule
    return out


@router.post("/rules/{rule_id}/apply-retroactively")
def apply_rule_retroactively(rule_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Applique une règle (manuelle OU apprise) à toutes les tx historiques du
    foyer qui ne sont pas déjà dans la catégorie cible. Utilisé par le snackbar
    'Appliquer aux N transactions historiques' qui apparaît après une règle
    apprise par Category Learning.

    Ne modifie PAS les tx déjà manuellement catégorisées par l'utilisateur
    (respect du travail passé).
    """
    from app.models import CategorisationRule
    rule = db.query(CategorisationRule).filter(
        CategorisationRule.id == rule_id,
        CategorisationRule.household_id == user.household_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle introuvable")
    target_cat = db.query(Category).filter(
        Category.household_id == user.household_id,
        Category.slug == rule.category_slug,
    ).first()
    if not target_cat:
        raise HTTPException(status_code=400, detail="Catégorie cible inconnue")

    # Match par payee_id si la règle est attachée à un payee (cas Category
    # Learning), sinon par regex sur le label.
    candidates = []
    if rule.payee_id:
        candidates = db.query(Transaction).filter(
            Transaction.household_id == user.household_id,
            Transaction.payee_id == rule.payee_id,
            (Transaction.category_id != target_cat.id) | (Transaction.category_id.is_(None)),
            Transaction.is_manual_category == False,  # noqa: E712
        ).all()
    else:
        import re as _re
        try:
            rx = _re.compile(rule.pattern, _re.IGNORECASE)
        except _re.error:
            raise HTTPException(status_code=400, detail="Pattern de règle invalide")
        all_txs = db.query(Transaction).filter(
            Transaction.household_id == user.household_id,
            Transaction.is_manual_category == False,  # noqa: E712
        ).all()
        candidates = [t for t in all_txs if rx.search(t.label or "")]

    updated = 0
    for t in candidates:
        t.category_id = target_cat.id
        t.cat_source = "learned_rule" if rule.created_by == "learning" else "user_rule"
        updated += 1
    db.commit()
    return {"updated": updated, "rule_id": rule_id, "category_slug": rule.category_slug}


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.household_id == user.household_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")
    db.delete(tx)
    db.commit()

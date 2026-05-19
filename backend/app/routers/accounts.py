"""
Accounts endpoints: bank accounts, with member assignment for joint accounts.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Account, Member, Transaction
from app.schemas import AccountCreate, AccountUpdate, AccountOut
from app.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _to_out(account: Account, db: Session) -> dict:
    """Serialize an Account.

    Pour le `current_balance` on privilegie maintenant le solde officiel
    GoCardless (`last_known_balance`) quand il est dispo. Sinon fallback
    sur le calcul classique initial_balance + somme(transactions).

    Fix 2026-05-19 : avant on retournait toujours le calcul, qui divergeait
    du vrai solde banque a cause des transactions pending non remontees
    par DSP2 (cas typique Revolut).
    """
    if account.last_known_balance is not None:
        current = float(account.last_known_balance)
    else:
        tx_sum = db.query(Transaction).filter(Transaction.account_id == account.id).all()
        current = (account.initial_balance or 0.0) + sum(t.amount for t in tx_sum)
    return {
        "id": account.id,
        "name": account.name,
        "bank": account.bank,
        "type": account.type,
        "role": account.role or "principal",
        "initial_balance": account.initial_balance,
        "currency": account.currency or "EUR",
        "household_id": account.household_id,
        "member_ids": [m.id for m in account.members],
        "current_balance": current,
        "last_known_balance": account.last_known_balance,
        # ISO 8601 avec marker Z (UTC). Sans le Z, JS parse en local time
        # -> ecart de 1-2h selon le fuseau, donne "il y a 2h" alors qu'on a
        # sync il y a 5 min. Bug user 2026-05-19.
        "last_balance_at": (account.last_balance_at.replace(microsecond=0).isoformat() + "Z") if account.last_balance_at else None,
        "is_joint": account.is_joint,
        "iban": account.iban,
        "source": account.source or "manual",
        "external_id": account.external_id,
    }


@router.get("")
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Note 2026-05-19 : `response_model=List[AccountOut]` retiré — Pydantic
    # crashait silencieusement sur la validation (sans logger la stack), ce
    # qui faisait remonter un 500 vide au frontend. Les Railway Deploy Logs
    # confirment que la route exécute correctement, le crash est uniquement
    # dans la phase de validation de la response. `_to_out` produit déjà
    # un dict propre, on le renvoie tel quel — FastAPI sérialise en JSON.
    accounts = db.query(Account).filter(Account.household_id == user.household_id).all()
    return [_to_out(a, db) for a in accounts]


@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude={"member_ids"})
    account = Account(household_id=user.household_id, **data)
    if payload.member_ids:
        members = db.query(Member).filter(
            Member.id.in_(payload.member_ids),
            Member.household_id == user.household_id,
        ).all()
        account.members = members
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_out(account, db)


@router.put("/{account_id}", response_model=AccountOut)
def update_account(account_id: str, payload: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    account = db.query(Account).filter(Account.id == account_id, Account.household_id == user.household_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouvé")
    data = payload.model_dump(exclude_unset=True)
    member_ids = data.pop("member_ids", None)
    for k, v in data.items():
        setattr(account, k, v)
    if member_ids is not None:
        members = db.query(Member).filter(
            Member.id.in_(member_ids),
            Member.household_id == user.household_id,
        ).all()
        account.members = members
    db.commit()
    db.refresh(account)
    return _to_out(account, db)


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    account = db.query(Account).filter(Account.id == account_id, Account.household_id == user.household_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouvé")
    db.delete(account)
    db.commit()


@router.post("/{target_id}/merge/{source_id}", response_model=AccountOut)
def merge_accounts(target_id: str, source_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Merge source into target: move all transactions, transfer external_id, delete source."""
    if target_id == source_id:
        raise HTTPException(status_code=400, detail="Impossible de fusionner un compte avec lui-même")
    target = db.query(Account).filter(Account.id == target_id, Account.household_id == user.household_id).first()
    source = db.query(Account).filter(Account.id == source_id, Account.household_id == user.household_id).first()
    if not target or not source:
        raise HTTPException(status_code=404, detail="Compte non trouvé")

    # Collect existing dedup hashes on the target to avoid creating duplicates.
    existing_hashes = {
        t.dedup_hash for t in
        db.query(Transaction).filter(Transaction.account_id == target_id, Transaction.dedup_hash.isnot(None)).all()
    }

    source_txs = db.query(Transaction).filter(Transaction.account_id == source_id).all()
    moved = 0
    for tx in source_txs:
        if tx.dedup_hash and tx.dedup_hash in existing_hashes:
            db.delete(tx)  # true duplicate — drop it
        else:
            tx.account_id = target_id
            if tx.dedup_hash:
                existing_hashes.add(tx.dedup_hash)
            moved += 1

    # Transfer GoCardless binding so future syncs populate the right account.
    if source.external_id and not target.external_id:
        target.external_id = source.external_id
        target.source = source.source

    db.delete(source)
    db.commit()
    db.refresh(target)
    return _to_out(target, db)

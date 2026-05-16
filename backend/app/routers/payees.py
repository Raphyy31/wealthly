"""Payees + categorization preview endpoints.

- GET    /payees                     liste les payees du foyer
- POST   /payees                     crée un payee manuellement
- PUT    /payees/{id}                rename / change default category / toggle is_transfer
- DELETE /payees/{id}                supprime (détache les tx)
- POST   /payees/{id}/merge/{other}  fusionne deux payees (réattribue tx + delete)
- POST   /categorize/preview         passe un libellé dans le moteur, renvoie le CategorizationResult complet
- POST   /categorize/learning/toggle bascule l'apprentissage auto on/off (à venir, stocké au foyer)
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Payee, Transaction, Category, CategorisationRule
from app.categorization import categorize_transaction


router = APIRouter(tags=["payees"])


# ─── Schémas ─────────────────────────────────────────────────────────────────

class PayeeOut(BaseModel):
    id: str
    name: str
    default_category_id: Optional[str]
    is_transfer: bool
    created_by: str
    model_config = ConfigDict(from_attributes=True)


class PayeeCreate(BaseModel):
    name: str
    default_category_slug: Optional[str] = None
    is_transfer: bool = False


class PayeeUpdate(BaseModel):
    name: Optional[str] = None
    default_category_slug: Optional[str] = None
    is_transfer: Optional[bool] = None


class PreviewRequest(BaseModel):
    label: str
    amount: float = 0.0


class PreviewResponse(BaseModel):
    slug: Optional[str]
    payee_name: Optional[str]
    payee_id: Optional[str]
    confidence: float
    source: str
    rule_id: Optional[str]
    matched_pattern: Optional[str]
    matched_on: Optional[str]
    is_transfer: bool


def _resolve_cat_id(db: Session, household_id: str, slug: Optional[str]) -> Optional[str]:
    if not slug:
        return None
    c = db.query(Category).filter(Category.household_id == household_id, Category.slug == slug).first()
    return c.id if c else None


# ─── Payees CRUD ─────────────────────────────────────────────────────────────

@router.get("/payees", response_model=List[PayeeOut])
def list_payees(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Payee).filter(Payee.household_id == user.household_id).order_by(Payee.name).all()


@router.post("/payees", response_model=PayeeOut, status_code=201)
def create_payee(payload: PayeeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nom requis")
    existing = db.query(Payee).filter(
        Payee.household_id == user.household_id,
        Payee.name.ilike(name),
    ).first()
    if existing:
        return existing
    p = Payee(
        household_id=user.household_id,
        name=name,
        default_category_id=_resolve_cat_id(db, user.household_id, payload.default_category_slug),
        is_transfer=payload.is_transfer,
        created_by="user",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/payees/{payee_id}", response_model=PayeeOut)
def update_payee(payee_id: str, payload: PayeeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(Payee).filter(Payee.id == payee_id, Payee.household_id == user.household_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payee introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "default_category_slug" in data:
        slug = data.pop("default_category_slug")
        p.default_category_id = _resolve_cat_id(db, user.household_id, slug)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/payees/{payee_id}", status_code=204)
def delete_payee(payee_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(Payee).filter(Payee.id == payee_id, Payee.household_id == user.household_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payee introuvable")
    # Détache les tx pointant vers ce payee (préserve les data, juste un cleanup)
    db.query(Transaction).filter(
        Transaction.household_id == user.household_id,
        Transaction.payee_id == p.id,
    ).update({Transaction.payee_id: None}, synchronize_session=False)
    db.delete(p)
    db.commit()


@router.post("/payees/{payee_id}/merge/{other_id}", status_code=200)
def merge_payees(payee_id: str, other_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Fusionne `other` dans `payee` : toutes les tx pointant vers `other`
    sont réassignées à `payee`, puis `other` est supprimé.
    """
    target = db.query(Payee).filter(Payee.id == payee_id, Payee.household_id == user.household_id).first()
    source = db.query(Payee).filter(Payee.id == other_id, Payee.household_id == user.household_id).first()
    if not target or not source:
        raise HTTPException(status_code=404, detail="Payee introuvable")
    if target.id == source.id:
        raise HTTPException(status_code=400, detail="Impossible de fusionner un payee avec lui-même")
    db.query(Transaction).filter(
        Transaction.household_id == user.household_id,
        Transaction.payee_id == source.id,
    ).update({Transaction.payee_id: target.id}, synchronize_session=False)
    # Migre aussi les CategorisationRule qui pointaient vers source
    db.query(CategorisationRule).filter(
        CategorisationRule.household_id == user.household_id,
        CategorisationRule.payee_id == source.id,
    ).update({CategorisationRule.payee_id: target.id}, synchronize_session=False)
    db.delete(source)
    db.commit()
    return {"merged_into": target.id, "merged_from": other_id}


# ─── Categorize preview (debug + UI Réglages → Règles) ──────────────────────

@router.post("/categorize/preview", response_model=PreviewResponse)
def preview_categorization(payload: PreviewRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Passe un libellé brut dans le moteur sans rien sauvegarder.
    Utile pour tester une règle avant de la créer, ou pour debug du moteur.
    """
    result = categorize_transaction(
        label=payload.label, amount=payload.amount,
        household_id=user.household_id, db=db,
    )
    return PreviewResponse(
        slug=result.slug,
        payee_name=result.payee_name,
        payee_id=result.payee_id,
        confidence=result.confidence,
        source=result.source,
        rule_id=result.rule_id,
        matched_pattern=result.matched_pattern,
        matched_on=result.matched_on,
        is_transfer=result.is_transfer,
    )

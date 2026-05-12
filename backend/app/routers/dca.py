"""DCA Plans — systematic investment plan CRUD."""
from datetime import datetime
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DcaPlan
from app.auth import get_current_user, User

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

    @field_validator('account_id', 'ticker', 'asset_name', 'notes', 'start_date', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == '' else v


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

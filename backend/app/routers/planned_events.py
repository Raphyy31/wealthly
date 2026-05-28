"""
Planned events endpoints — one-off, future-dated cash movements entered by
the user (rattrapage d'impôts, prime, gros achat…). They power the forward
cash-flow projection (Vue Projection): the projection engine applies each
event on its `date` to the running liquid balance.

Unlike FixedCharge (recurring) these happen once. `amount` is stored
positive; `direction` ('in' | 'out') carries the sign.
"""
from datetime import date as date_cls, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import PlannedEvent, User

router = APIRouter(prefix="/planned-events", tags=["planned-events"])


class PlannedEventIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    amount: float = Field(ge=0)
    direction: str = Field(default="out", pattern=r"^(in|out)$")
    date: date_cls
    account_id: Optional[str] = None
    category_slug: Optional[str] = None
    notes: Optional[str] = ""


class PlannedEventOut(BaseModel):
    id: str
    label: str
    amount: float
    direction: str
    date: date_cls
    account_id: Optional[str] = None
    category_slug: Optional[str] = None
    notes: str = ""


def _to_out(ev: PlannedEvent) -> PlannedEventOut:
    return PlannedEventOut(
        id=ev.id,
        label=ev.label,
        amount=ev.amount,
        direction=ev.direction or "out",
        date=ev.date,
        account_id=ev.account_id,
        category_slug=ev.category_slug,
        notes=ev.notes or "",
    )


@router.get("", response_model=list[PlannedEventOut])
def list_planned_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(PlannedEvent).filter(
        PlannedEvent.household_id == user.household_id,
    ).order_by(PlannedEvent.date.asc()).all()
    return [_to_out(it) for it in items]


@router.post("", response_model=PlannedEventOut, status_code=201)
def create_planned_event(payload: PlannedEventIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ev = PlannedEvent(
        household_id=user.household_id,
        label=payload.label.strip(),
        amount=abs(float(payload.amount)),
        direction=payload.direction or "out",
        date=payload.date,
        account_id=payload.account_id or None,
        category_slug=payload.category_slug,
        notes=(payload.notes or "")[:1000],
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _to_out(ev)


@router.put("/{event_id}", response_model=PlannedEventOut)
def update_planned_event(event_id: str, payload: PlannedEventIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ev = db.query(PlannedEvent).filter(
        PlannedEvent.id == event_id,
        PlannedEvent.household_id == user.household_id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    ev.label = payload.label.strip()
    ev.amount = abs(float(payload.amount))
    ev.direction = payload.direction or "out"
    ev.date = payload.date
    ev.account_id = payload.account_id or None
    ev.category_slug = payload.category_slug
    ev.notes = (payload.notes or "")[:1000]
    ev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return _to_out(ev)


@router.delete("/{event_id}", status_code=204)
def delete_planned_event(event_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ev = db.query(PlannedEvent).filter(
        PlannedEvent.id == event_id,
        PlannedEvent.household_id == user.household_id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    db.delete(ev)
    db.commit()

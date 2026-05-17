"""
RefMonth (Mois type) endpoints — JSON budget template scoped per
(household, member). `member_id` query param :
  - omitted  → ménage / "Famille" (compte joint)
  - "<id>"   → Mois type personnel de cet adulte
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, RefMonth, Member
from app.schemas import RefMonthIn, RefMonthOut

router = APIRouter(prefix="/me/ref-month", tags=["ref_month"])


def _resolve_member_id(raw: Optional[str], db: Session, user: User) -> Optional[str]:
    """Accept '', 'household', None → household-level. Else validate member."""
    if not raw or raw.lower() in ("household", "famille", "all", "null"):
        return None
    member = db.query(Member).filter(Member.id == raw, Member.household_id == user.household_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    return member.id


def _get_or_seed(db: Session, user: User, member_id: Optional[str]) -> RefMonth:
    """Fetch the RefMonth row for this scope. Lazy-migrate from the legacy
    User.ref_month JSON the first time the user's own scope is requested."""
    row = (
        db.query(RefMonth)
          .filter(RefMonth.household_id == user.household_id, RefMonth.member_id == member_id)
          .first()
    )
    if row:
        return row

    # Lazy migration : if the user is fetching their personal scope and the
    # legacy User.ref_month JSON has lines, port them once.
    seed_lines = []
    seed_version = 1
    seed_updated = None
    if member_id and user.member_id == member_id and user.ref_month:
        legacy = user.ref_month or {}
        seed_lines = legacy.get("lines") or []
        seed_version = int(legacy.get("version") or 1)
        seed_updated = legacy.get("updated_at")

    now = datetime.utcnow()
    row = RefMonth(
        household_id=user.household_id,
        member_id=member_id,
        version=seed_version,
        lines=seed_lines,
        updated_at=now if not seed_updated else now,  # always stamp now to keep TZ-naive
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _serialize(row: RefMonth) -> RefMonthOut:
    return RefMonthOut(
        version=int(row.version or 1),
        updated_at=row.updated_at.date().isoformat() if row.updated_at else None,
        lines=row.lines or [],
    )


@router.get("", response_model=RefMonthOut)
def get_ref_month(
    member_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the Mois type for the given scope (member_id or household)."""
    scope = _resolve_member_id(member_id, db, user)
    row = _get_or_seed(db, user, scope)
    return _serialize(row)


@router.put("", response_model=RefMonthOut)
def put_ref_month(
    payload: RefMonthIn,
    member_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Replace the Mois type for the given scope. Upserts the row."""
    scope = _resolve_member_id(member_id, db, user)
    row = _get_or_seed(db, user, scope)
    row.version = payload.version
    row.lines = [line.model_dump() for line in payload.lines]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize(row)

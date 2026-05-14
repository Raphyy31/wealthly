"""
RefMonth (Mois type) endpoints — JSON budget template per user.

See docs/superpowers/specs/2026-05-14-budget-mensuel-refonte-design.md
for the data shape and rationale.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import RefMonthIn, RefMonthOut

router = APIRouter(prefix="/me/ref-month", tags=["ref_month"])


@router.get("", response_model=RefMonthOut)
def get_ref_month(user: User = Depends(get_current_user)):
    """Return the current user's Mois type. Empty template if never set."""
    data = user.ref_month or {}
    return RefMonthOut(
        version=int(data.get("version", 1)),
        updated_at=data.get("updated_at"),
        lines=data.get("lines", []),
    )


@router.put("", response_model=RefMonthOut)
def put_ref_month(
    payload: RefMonthIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Replace the user's Mois type wholesale."""
    now = datetime.utcnow().date().isoformat()
    user.ref_month = {
        "version": payload.version,
        "updated_at": now,
        "lines": [line.model_dump() for line in payload.lines],
    }
    db.commit()
    return RefMonthOut(**user.ref_month)

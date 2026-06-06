"""
Notifications / alertes intelligentes.

- GET  /notifications            → liste (non-lues d'abord, récentes)
- POST /notifications/refresh    → lance la détection (idempotente) + renvoie la liste
- PATCH /notifications/{id}/read → marque lue
- POST /notifications/read-all   → marque tout lu
- DELETE /notifications/{id}     → écarte (dismiss)
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Notification, User
from app.services.alerts import run_detection

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: str
    kind: str
    severity: str
    title: str
    body: str
    data: dict = {}
    link: Optional[str] = None
    status: str
    created_at: Optional[str] = None


def _to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id, kind=n.kind, severity=n.severity, title=n.title, body=n.body or "",
        data=n.data or {}, link=n.link, status=n.status,
        created_at=n.created_at.isoformat() if n.created_at else None,
    )


def _list(db: Session, household_id: str) -> list[NotificationOut]:
    items = db.query(Notification).filter(
        Notification.household_id == household_id,
        Notification.status != 'dismissed',
    ).order_by(
        # non-lues d'abord, puis par date décroissante
        (Notification.status == 'unread').desc(),
        Notification.created_at.desc(),
    ).limit(50).all()
    return [_to_out(n) for n in items]


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _list(db, user.household_id)


@router.post("/refresh", response_model=list[NotificationOut])
def refresh_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        run_detection(db, user.household_id)
    except Exception:
        # La détection ne doit jamais casser l'app — on renvoie l'existant.
        db.rollback()
    return _list(db, user.household_id)


@router.put("/{notif_id}/read", response_model=NotificationOut)
def mark_read(notif_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notif_id, Notification.household_id == user.household_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    n.status = 'read'
    n.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _to_out(n)


@router.post("/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.household_id == user.household_id,
        Notification.status == 'unread',
    ).update({Notification.status: 'read', Notification.updated_at: datetime.utcnow()})
    db.commit()


@router.delete("/{notif_id}", status_code=204)
def dismiss(notif_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notif_id, Notification.household_id == user.household_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    n.status = 'dismissed'
    n.updated_at = datetime.utcnow()
    db.commit()

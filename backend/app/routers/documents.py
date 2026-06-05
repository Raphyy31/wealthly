"""
Coffre-fort documents — upload/list/download/delete de fichiers (factures,
baux, justificatifs…).

v1 : stockage des octets en base (LargeBinary). Plafond de taille + allowlist
de types appliqués ici. Scopé par foyer comme tout le reste.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, User

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_SIZE = 8 * 1024 * 1024  # 8 Mo / fichier
ALLOWED = {
    "application/pdf",
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
}
VALID_CATEGORIES = {"facture", "bail", "assurance", "justificatif", "autre"}


class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size_bytes: int
    category: Optional[str] = None
    account_id: Optional[str] = None
    asset_id: Optional[str] = None
    notes: str = ""
    created_at: Optional[str] = None


def _to_out(d: Document) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        filename=d.filename,
        content_type=d.content_type,
        size_bytes=d.size_bytes,
        category=d.category,
        account_id=d.account_id,
        asset_id=d.asset_id,
        notes=d.notes or "",
        created_at=d.created_at.isoformat() if d.created_at else None,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(Document).filter(
        Document.household_id == user.household_id,
    ).order_by(Document.created_at.desc()).all()
    return [_to_out(it) for it in items]


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: Optional[str] = Form(None),
    account_id: Optional[str] = Form(None),
    asset_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 8 Mo).")
    ctype = file.content_type or "application/octet-stream"
    if ctype not in ALLOWED:
        raise HTTPException(status_code=415, detail="Type de fichier non autorisé.")
    cat = category if category in VALID_CATEGORIES else None

    doc = Document(
        household_id=user.household_id,
        filename=(file.filename or "document")[:255],
        content_type=ctype,
        size_bytes=len(content),
        category=cat,
        account_id=account_id or None,
        asset_id=asset_id or None,
        notes=(notes or "")[:1000],
        data=content,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.get("/{doc_id}/download")
def download_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.household_id == user.household_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    # inline pour les images/pdf (preview navigateur), filename conservé.
    safe_name = (doc.filename or "document").replace('"', "")
    return Response(
        content=doc.data,
        media_type=doc.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@router.put("/{doc_id}", response_model=DocumentOut)
def update_document(
    doc_id: str,
    category: Optional[str] = Form(None),
    account_id: Optional[str] = Form(None),
    asset_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.household_id == user.household_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if category is not None:
        doc.category = category if category in VALID_CATEGORIES else None
    if account_id is not None:
        doc.account_id = account_id or None
    if asset_id is not None:
        doc.asset_id = asset_id or None
    if notes is not None:
        doc.notes = (notes or "")[:1000]
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.household_id == user.household_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    db.delete(doc)
    db.commit()

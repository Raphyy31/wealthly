"""Category Learning — mécanisme qui rend le système meilleur avec l'usage.

Inspiré d'Actual Budget : quand l'utilisateur recatégorise manuellement
LEARNING_THRESHOLD fois le même payee dans la même catégorie, on crée
automatiquement une CategorisationRule(created_by='learning'). Tous les
imports suivants bénéficient de cette règle sans config explicite.
"""
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Transaction, CategorisationRule, Payee, Category


LEARNING_THRESHOLD = 2  # nombre d'observations avant création d'une règle apprise


def on_transaction_recategorized(
    *,
    tx: Transaction,
    new_category_id: str,
    household_id: str,
    db: Session,
) -> bool:
    """À appeler après chaque PATCH /transactions/{id} qui change category_id.

    Retourne True si une règle apprise vient d'être créée ou mise à jour.
    """
    if tx.payee_id is None:
        return False  # pas de payee canonique → rien à apprendre
    if not new_category_id:
        return False

    # 1) Compter les observations existantes (payee × catégorie) sur ce foyer.
    observation_count = db.query(Transaction).filter(
        Transaction.payee_id == tx.payee_id,
        Transaction.category_id == new_category_id,
        Transaction.household_id == household_id,
    ).count()

    if observation_count < LEARNING_THRESHOLD:
        return False

    # 2) Une règle apprise existe-t-elle déjà pour ce payee ?
    existing = db.query(CategorisationRule).filter(
        CategorisationRule.household_id == household_id,
        CategorisationRule.payee_id == tx.payee_id,
        CategorisationRule.created_by == "learning",
    ).first()

    # Résolution du slug de la nouvelle catégorie
    new_cat = db.query(Category).filter(
        Category.id == new_category_id,
        Category.household_id == household_id,
    ).first()
    if not new_cat:
        return False

    if existing:
        # L'utilisateur a changé d'avis → on update le slug, pas de doublon.
        if existing.category_slug != new_cat.slug:
            existing.category_slug = new_cat.slug
            existing.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False

    # 3) Crée la règle apprise. Pattern = nom du payee (case-insensitive).
    payee = db.query(Payee).filter(Payee.id == tx.payee_id).first()
    if not payee:
        return False

    rule = CategorisationRule(
        household_id=household_id,
        pattern=payee.name,
        category_slug=new_cat.slug,
        source="learned",
        created_by="learning",
        rule_type="category",
        payee_id=payee.id,
        priority=50,  # entre user (100) et builtin (10)
    )
    db.add(rule)
    db.commit()
    return True

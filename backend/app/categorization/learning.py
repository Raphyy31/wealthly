"""Category Learning — mécanisme qui rend le système meilleur avec l'usage.

Inspiré d'Actual Budget : quand l'utilisateur recatégorise manuellement
LEARNING_THRESHOLD fois le même payee dans la même catégorie, on crée
automatiquement une CategorisationRule(created_by='learning'). Tous les
imports suivants bénéficient de cette règle sans config explicite.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Transaction, CategorisationRule, Payee, Category


LEARNING_THRESHOLD = 2  # nombre d'observations avant création d'une règle apprise


def on_transaction_recategorized(
    *,
    tx: Transaction,
    new_category_id: str,
    household_id: str,
    db: Session,
) -> Optional[dict]:
    """À appeler après chaque PATCH /transactions/{id} qui change category_id.

    Retourne un dict {rule_id, payee_name, category_name, matchable_count}
    si une règle apprise vient d'être créée OU mise à jour — sinon None.
    Le dict alimente le toast UI 'Wealthly a appris X → Y' + le bouton
    'Appliquer aux N transactions historiques'.
    """
    if tx.payee_id is None:
        return None  # pas de payee canonique → rien à apprendre
    if not new_category_id:
        return None

    # 1) Compter les observations existantes (payee × catégorie) sur ce foyer.
    observation_count = db.query(Transaction).filter(
        Transaction.payee_id == tx.payee_id,
        Transaction.category_id == new_category_id,
        Transaction.household_id == household_id,
    ).count()

    if observation_count < LEARNING_THRESHOLD:
        return None

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
        return None

    payee = db.query(Payee).filter(Payee.id == tx.payee_id).first()
    if not payee:
        return None

    # Compte combien de tx historiques (autres que celle qu'on vient de
    # recatégoriser) pointent vers ce payee et ne sont PAS encore dans la
    # bonne catégorie — c'est le nombre de candidates pour l'apply rétroactif.
    matchable_count = db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.payee_id == tx.payee_id,
        Transaction.id != tx.id,
        (Transaction.category_id != new_category_id) | (Transaction.category_id.is_(None)),
    ).count()

    if existing:
        # L'utilisateur a changé d'avis → on update le slug, pas de doublon.
        if existing.category_slug != new_cat.slug:
            existing.category_slug = new_cat.slug
            existing.updated_at = datetime.utcnow()
            db.commit()
            return {
                "rule_id": existing.id,
                "payee_name": payee.name,
                "category_name": new_cat.name,
                "category_slug": new_cat.slug,
                "matchable_count": matchable_count,
                "updated": True,
            }
        return None

    # 3) Crée la règle apprise. Pattern = nom du payee (case-insensitive).
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
    db.refresh(rule)
    return {
        "rule_id": rule.id,
        "payee_name": payee.name,
        "category_name": new_cat.name,
        "category_slug": new_cat.slug,
        "matchable_count": matchable_count,
        "updated": False,
    }

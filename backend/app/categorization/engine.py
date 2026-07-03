"""Moteur de catégorisation Yotori Finance.

Ordre de résolution (déterministe, stable, garde-fou single source of truth) :
  1. user_rule      : CategorisationRule(created_by='user') du foyer
  2. payee_default  : Payee résolu + default_category_id présent
  3. learned_rule   : CategorisationRule(created_by='learning') du foyer
  4. builtin_rule   : règle livrée d'origine dans rules.py
  5. unknown        : rien ne matche → None

Le LLM ne vit PAS ici (refonte 2026-07-03) : la couche IA est batch et
provider-agnostique (Anthropic/OpenAI) dans routers/categorize.py — le moteur
reste 100 % déterministe et gratuit, appelé sur chaque insertion (import CSV,
sync bancaire, saisie manuelle) ; l'IA n'est sollicitée qu'à la demande sur
les libellés que le moteur ne résout pas.

La couche payee EST le mécanisme qui permet à l'utilisateur de requalifier
"Franprix" partout d'un coup. La couche learning est ce qui rend le système
meilleur avec l'usage.
"""
from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional, Literal
import re

from sqlalchemy.orm import Session

from app.models import (
    CategorisationRule, Category, Payee, PayeeMatchRule,
)
from .normalize import normalize_label, NormalizedLabel
from .rules import COMPILED_RULES, rule_matches


CatSource = Literal["user_rule", "payee_default", "learned_rule", "builtin_rule", "llm", "unknown"]


@dataclass
class CategorizationResult:
    slug: Optional[str]
    payee_name: Optional[str] = None
    payee_id: Optional[str] = None
    confidence: float = 0.0
    source: CatSource = "unknown"
    rule_id: Optional[str] = None
    matched_pattern: Optional[str] = None
    matched_on: Optional[Literal["merchant", "raw", "payee", "llm"]] = None
    is_transfer: bool = False


def _norm_name(s: str) -> str:
    return (s or "").strip().lower()


def _find_or_create_payee(
    db: Session,
    household_id: str,
    name: str,
    default_slug: Optional[str],
    is_transfer: bool,
    created_by: str = "builtin",
) -> Payee:
    """Trouve un payee canonique par nom (case-insensitive) ou le crée à la volée."""
    existing = db.query(Payee).filter(
        Payee.household_id == household_id,
    ).all()
    target = _norm_name(name)
    for p in existing:
        if _norm_name(p.name) == target:
            return p

    # Création — on essaie de résoudre la catégorie par défaut via son slug.
    default_cat_id = None
    if default_slug:
        cat = db.query(Category).filter(
            Category.household_id == household_id,
            Category.slug == default_slug,
        ).first()
        if cat:
            default_cat_id = cat.id

    payee = Payee(
        household_id=household_id,
        name=name,
        default_category_id=default_cat_id,
        is_transfer=is_transfer,
        created_by=created_by,
    )
    db.add(payee)
    db.flush()  # pour avoir l'id sans commit
    return payee


def _category_slug_of(db: Session, household_id: str, category_id: Optional[str]) -> Optional[str]:
    if not category_id:
        return None
    cat = db.query(Category).filter(Category.id == category_id, Category.household_id == household_id).first()
    return cat.slug if cat else None


def categorize_transaction(
    *,
    label: str,
    amount: float,
    household_id: str,
    db: Session,
    date: Optional[date] = None,
) -> CategorizationResult:
    """Entrée principale du moteur. Idempotent, déterministe."""
    normalized = normalize_label(label)
    merchant = normalized.merchant
    raw = normalized.raw

    # ── Couche 1 : user_rule (priorité absolue)
    user_rules = db.query(CategorisationRule).filter(
        CategorisationRule.household_id == household_id,
        CategorisationRule.created_by == "user",
    ).order_by(CategorisationRule.priority.desc()).all()

    for r in user_rules:
        try:
            regex = re.compile(r.pattern, re.IGNORECASE)
        except re.error:
            continue
        # User rules peuvent être de type 'transfer' (flag) ou 'category' (assign)
        if regex.search(merchant) or regex.search(raw):
            if r.rule_type == "transfer":
                return CategorizationResult(
                    slug=None, source="user_rule", rule_id=r.id,
                    matched_pattern=r.pattern, matched_on="merchant" if regex.search(merchant) else "raw",
                    is_transfer=True, confidence=1.0,
                )
            return CategorizationResult(
                slug=r.category_slug, source="user_rule", rule_id=r.id,
                matched_pattern=r.pattern, matched_on="merchant" if regex.search(merchant) else "raw",
                confidence=1.0,
            )

    # ── Couche 2 : Payee resolution + default_category_id
    payee_id = None
    payee_name = None
    is_transfer_payee = False
    payee_default_slug = None

    # 2a) Exact match sur Payee.name (case-insensitive)
    if merchant:
        target = _norm_name(merchant)
        all_payees = db.query(Payee).filter(Payee.household_id == household_id).all()
        for p in all_payees:
            if _norm_name(p.name) == target:
                payee_id = p.id
                payee_name = p.name
                is_transfer_payee = p.is_transfer
                payee_default_slug = _category_slug_of(db, household_id, p.default_category_id)
                break

        # 2b) PayeeMatchRule user-defined (substring/regex)
        if not payee_id:
            match_rules = db.query(PayeeMatchRule).filter(
                PayeeMatchRule.household_id == household_id,
            ).order_by(PayeeMatchRule.priority.desc()).all()
            # Tri par spécificité : plus long > plus court
            match_rules.sort(key=lambda r: (-r.priority, -len(r.pattern)))
            for mr in match_rules:
                pat = mr.pattern
                target_str = merchant if mr.match_against == "merchant" else (raw if mr.match_against == "raw" else f"{merchant} {raw}")
                hit = False
                if mr.match_type == "exact":
                    hit = _norm_name(pat) == _norm_name(target_str)
                elif mr.match_type == "contains":
                    hit = _norm_name(pat) in _norm_name(target_str)
                elif mr.match_type == "regex":
                    try:
                        hit = bool(re.search(pat, target_str, re.IGNORECASE))
                    except re.error:
                        hit = False
                if hit:
                    p = db.query(Payee).filter(Payee.id == mr.payee_id).first()
                    if p:
                        payee_id = p.id
                        payee_name = p.name
                        is_transfer_payee = p.is_transfer
                        payee_default_slug = _category_slug_of(db, household_id, p.default_category_id)
                        break

    if payee_id and is_transfer_payee:
        return CategorizationResult(
            slug=None, source="payee_default", payee_id=payee_id, payee_name=payee_name,
            matched_on="payee", confidence=0.95, is_transfer=True,
        )

    if payee_id and payee_default_slug:
        return CategorizationResult(
            slug=payee_default_slug, source="payee_default", payee_id=payee_id, payee_name=payee_name,
            matched_on="payee", confidence=0.9,
        )

    # ── Couche 3 : learned_rule (CategorisationRule créées par l'apprentissage)
    learned_rules = db.query(CategorisationRule).filter(
        CategorisationRule.household_id == household_id,
        CategorisationRule.created_by == "learning",
    ).order_by(CategorisationRule.priority.desc()).all()
    for r in learned_rules:
        try:
            regex = re.compile(r.pattern, re.IGNORECASE)
        except re.error:
            continue
        if regex.search(merchant) or regex.search(raw):
            if r.rule_type == "transfer":
                return CategorizationResult(
                    slug=None, source="learned_rule", rule_id=r.id,
                    matched_pattern=r.pattern, matched_on="merchant" if regex.search(merchant) else "raw",
                    is_transfer=True, confidence=0.85,
                )
            return CategorizationResult(
                slug=r.category_slug, source="learned_rule", rule_id=r.id,
                matched_pattern=r.pattern, matched_on="merchant" if regex.search(merchant) else "raw",
                confidence=0.85,
            )

    # ── Couche 4 : builtin rules (bootstrap)
    for cr in COMPILED_RULES:
        matched, on = rule_matches(cr.rule, cr.regex, merchant, raw, amount, normalized.operation_type)
        if not matched:
            continue
        # Si la règle déclare un payee_name, on s'assure qu'il existe en DB.
        b_payee_id = None
        if cr.rule.payee_name:
            payee = _find_or_create_payee(
                db, household_id, cr.rule.payee_name,
                default_slug=cr.rule.slug if not cr.rule.is_transfer else None,
                is_transfer=cr.rule.is_transfer,
                created_by="builtin",
            )
            b_payee_id = payee.id
            payee_name = payee.name
        if cr.rule.is_transfer:
            return CategorizationResult(
                slug=None, source="builtin_rule", payee_id=b_payee_id, payee_name=payee_name,
                rule_id=cr.rule.id, matched_pattern=cr.rule.pattern_str, matched_on=on,
                is_transfer=True, confidence=0.85,
            )
        return CategorizationResult(
            slug=cr.rule.slug, source="builtin_rule", payee_id=b_payee_id, payee_name=payee_name,
            rule_id=cr.rule.id, matched_pattern=cr.rule.pattern_str, matched_on=on,
            confidence=0.8,
        )

    # ── Couche 5 : unknown (le LLM batch vit dans routers/categorize.py)
    return CategorizationResult(slug=None, source="unknown", confidence=0.0)

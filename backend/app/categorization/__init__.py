"""Yotori Finance categorization engine — Payees + Category Learning + builtin rules.

Architecture en 3 couches (inspirée d'Actual Budget) :
  1. normalize : nettoie le libellé brut bancaire
  2. payees    : résout le marchand canonique (Uber, Franprix…)
  3. engine    : applique l'ordre de résolution user_rule → payee_default →
                 learned_rule → builtin_rule → llm → unknown

Le router HTTP `routers/categorize.py` est un mince adaptateur qui appelle
`engine.categorize_transaction(...)`. Aucune regex ne vit dans le router.
"""
from .engine import categorize_transaction, CategorizationResult  # noqa: F401
from .normalize import normalize_label, NormalizedLabel  # noqa: F401

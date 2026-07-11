"""
AI-powered transaction categorization endpoint.

POST /categorize — refonte « moteur unique » (2026-07-03) :
  - Accepts a list of {label, amount} transactions
  - Chaque libellé passe D'ABORD par le moteur canonique
    `app.categorization.categorize_transaction` (normalisation du libellé +
    règles user → payees → règles apprises → ~120 règles builtin) — la même
    résolution que l'import CSV, la sync bancaire et la saisie manuelle.
    Plus AUCUNE liste de regex dupliquée ici.
  - Les libellés non résolus partent en batch vers un LLM — provider au
    choix : Anthropic (Claude Haiku) ou OpenAI (gpt-4.1-nano par défaut),
    sélection via AI_PROVIDER ("auto" = Anthropic si clé posée, sinon OpenAI).
    Le prompt reçoit le marchand NORMALISÉ en indice (meilleure précision,
    moins de tokens).
  - Returns {label -> category_slug} + {label -> source} (user_rule /
    payee_default / learned_rule / builtin_rule / llm) pour que le client
    sache quoi persister : les résultats moteur sont re-résolus serveur à
    l'insertion, seuls les résultats LLM doivent voyager en category_slug.
  - Gracefully returns "uncategorized" for all if no provider key is set
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Category, Transaction
from app.config import settings
from app.rate_limit import limiter
from app.categorization import categorize_transaction, normalize_label

router = APIRouter(prefix="/categorize", tags=["categorize"])
logger = logging.getLogger("yotori.categorize")

class TxInput(BaseModel):
    label: str
    amount: float


class CategorizeRequest(BaseModel):
    transactions: list[TxInput]


class CategorizeResponse(BaseModel):
    results: dict[str, str]   # label -> category_slug
    # label -> source de résolution ('user_rule' | 'payee_default' |
    # 'learned_rule' | 'builtin_rule' | 'llm' | 'transfer'). Additif —
    # les clients existants qui ne lisent que `results` restent valides.
    sources: dict[str, str] = {}
    ai_used: bool
    ai_available: bool
    # Raison compacte de l'échec LLM (ex. "openai_http_429_insufficient_quota",
    # "openai_http_401"). Jamais de secret — sert au diagnostic sans accès aux
    # logs serveur. None si pas d'appel IA ou succès.
    ai_error: str | None = None


def _ai_provider() -> str | None:
    """Wrapper fin sur services.llm.resolve_provider (gardé au niveau module
    pour les tests qui le monkeypatchent)."""
    from app.services.llm import resolve_provider
    return resolve_provider()


class EnginePassResult(BaseModel):
    updated: int
    # [{id, category_slug, cat_source, is_transfer_override}] — uniquement les
    # transactions modifiées, pour merge côté client sans reload complet.
    results: list[dict]


@router.post("/engine", response_model=EnginePassResult)
@limiter.limit("200/day")
def engine_pass(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Passe GRATUITE automatique : re-résout via le moteur canonique toutes
    les transactions non catégorisées du foyer. Zéro LLM, zéro coût — le
    client l'appelle silencieusement au chargement pour « soigner »
    l'historique à mesure que règles custom / payees / règles apprises
    s'enrichissent. Le bouton IA ne s'occupe plus que des résistantes.

    Ne touche JAMAIS : les catégories verrouillées (is_manual_category),
    les virements marqués explicitement (is_transfer_override non-null).
    """
    hid = current_user.household_id
    cats = db.query(Category).filter(Category.household_id == hid).all()
    slug_to_id = {c.slug: c.id for c in cats}
    uncat_id = slug_to_id.get("uncategorized")

    candidates = db.query(Transaction).filter(
        Transaction.household_id == hid,
        Transaction.is_manual_category.is_(False),
        or_(Transaction.category_id.is_(None), Transaction.category_id == uncat_id),
    ).all()

    changed: list[dict] = []
    for tx in candidates:
        # Flag virement posé explicitement (true OU false) = décision de
        # l'utilisateur ou d'une détection antérieure → on ne re-décide pas.
        if tx.is_transfer_override is not None and tx.is_transfer_override:
            continue
        result = categorize_transaction(
            label=tx.label, amount=tx.amount, household_id=hid, db=db, date=tx.date,
        )
        if result.is_transfer:
            if tx.is_transfer_override is None:
                tx.is_transfer_override = True
                tx.cat_source = result.source
                changed.append({
                    "id": tx.id, "category_slug": None,
                    "cat_source": result.source, "is_transfer_override": True,
                })
        elif result.slug and result.slug in slug_to_id:
            new_cat_id = slug_to_id[result.slug]
            if tx.category_id != new_cat_id:
                tx.category_id = new_cat_id
                tx.payee_id = result.payee_id or tx.payee_id
                tx.cat_source = result.source
                changed.append({
                    "id": tx.id, "category_slug": result.slug,
                    "cat_source": result.source, "is_transfer_override": tx.is_transfer_override,
                })

    db.commit()
    return EnginePassResult(updated=len(changed), results=changed)


@router.post("", response_model=CategorizeResponse)
@limiter.limit("100/day")
def categorize(
    payload: CategorizeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.transactions:
        return CategorizeResponse(results={}, sources={}, ai_used=False, ai_available=_ai_provider() is not None)

    # Catégories du foyer : slugs valides (garde-fou LLM) + noms lisibles
    # pour construire un prompt fidèle au paramétrage réel (sous-catégories
    # custom incluses), plutôt qu'un catalogue figé.
    _cats = db.query(Category).filter(
        Category.household_id == current_user.household_id
    ).all()
    valid_slugs = {c.slug for c in _cats}
    slug_names = {c.slug: c.name for c in _cats}

    results: dict[str, str] = {}
    sources: dict[str, str] = {}
    unmatched: list[TxInput] = []

    # ── Pass 1 : moteur canonique (normalize → user rules → payees →
    # learned → builtin). Une seule source de vérité, identique à l'import
    # CSV / la sync / la saisie manuelle. Dédoublonne par libellé (un CSV
    # contient souvent 30× « NETFLIX.COM ») pour ne résoudre qu'une fois.
    seen: dict[str, TxInput] = {}
    for tx in payload.transactions:
        seen.setdefault(tx.label, tx)

    for label, tx in seen.items():
        result = categorize_transaction(
            label=label, amount=tx.amount,
            household_id=current_user.household_id, db=db,
        )
        if result.is_transfer:
            # Contrat historique de l'endpoint : 'transfer' est un slug
            # spécial que le client transforme en flag virement interne.
            results[label] = "transfer"
            sources[label] = result.source
        elif result.slug and result.slug in valid_slugs:
            results[label] = result.slug
            sources[label] = result.source
        else:
            unmatched.append(tx)

    ai_used = False
    ai_error = None
    provider = _ai_provider()
    ai_available = provider is not None

    # ── Pass 2 : LLM (Claude Haiku ou OpenAI) pour les libellés que le
    # moteur ne résout pas — bloqué si plafond mensuel atteint. Le plafond
    # ai_budget s'applique quel que soit le provider. TOUT le bloc (under_cap
    # compris) est best-effort : un souci ai_state/LLM ne doit jamais faire
    # perdre les résultats gratuits du moteur déjà calculés.
    from app.services.ai_budget import under_cap, record_use
    if unmatched and provider:
        try:
            if under_cap(db, current_user.household_id):
                ai_results = _categorize_with_ai(provider, unmatched, list(valid_slugs), slug_names)
                for label, slug in ai_results.items():
                    results[label] = slug
                    sources[label] = "llm"
                ai_used = True
                record_use(db, current_user.household_id)
        except Exception as exc:
            # Log serveur + raison compacte renvoyée au client (diagnostic
            # sans accès aux logs : 401 clé, 429 insufficient_quota = crédits
            # absents, modèle inconnu…). Aucun secret dans _compact_ai_error.
            logger.warning("[categorize] LLM %s failed: %s", provider, exc)
            ai_error = _compact_ai_error(provider, exc)
            # Une erreur HTTP du provider laisse la transaction SQL saine,
            # mais une erreur dans under_cap()/ai_state (RLS, colonne absente…)
            # place Postgres en transaction annulée. Sans rollback, le commit
            # final levait PendingRollbackError et transformait notre fallback
            # volontaire en 500 — le navigateur n'affichait qu'un message
            # générique et Railway ne montrait parfois que /auth/me.
            db.rollback()
    for tx in unmatched:
        if tx.label not in results:
            results[tx.label] = "uncategorized"

    # Le moteur crée des payees à la volée (db.flush) pendant la résolution
    # builtin — on les persiste pour que les prochaines résolutions (et la
    # couche learning) s'appuient dessus.
    try:
        db.commit()
    except Exception as exc:
        # Les résultats gratuits/LLM sont déjà calculés en mémoire. Un échec de
        # persistance des payees secondaires ne doit pas faire échouer toute la
        # catégorisation : rollback propre + diagnostic compact dans la réponse.
        db.rollback()
        logger.warning("[categorize] final persistence failed: %s", exc)
        if ai_error is None:
            ai_error = f"database_{type(exc).__name__}"

    return CategorizeResponse(results=results, sources=sources, ai_used=ai_used, ai_available=ai_available, ai_error=ai_error)


def _compact_ai_error(provider: str, exc: Exception) -> str:
    """Raison d'échec LLM compacte et SANS SECRET pour la réponse API.
    Ex.: openai_http_429_insufficient_quota, openai_http_403_model_not_found:gpt-5,
    anthropic_timeout. Le modèle en cause (dernier candidat tenté) est ajouté
    quand il est lisible dans la requête — diagnostic chaîne de repli."""
    try:
        import httpx
        if isinstance(exc, httpx.HTTPStatusError):
            code = exc.response.status_code
            detail = ""
            try:
                err = exc.response.json().get("error") or {}
                detail = err.get("code") or err.get("type") or ""
            except Exception:
                pass
            model = ""
            try:
                model = json.loads(exc.request.content or b"{}").get("model") or ""
            except Exception:
                pass
            out = f"{provider}_http_{code}" + (f"_{detail}" if detail else "")
            return out + (f":{model}" if model else "")
        if isinstance(exc, httpx.TimeoutException):
            return f"{provider}_timeout"
    except Exception:
        pass
    return f"{provider}_{type(exc).__name__}"


def _build_prompt(transactions: list[TxInput], valid_slugs: list[str], slug_names: dict[str, str] | None = None) -> str:
    # Descriptions riches pour les slugs standards ; les catégories custom du
    # foyer tombent sur leur nom lisible (slug_names, depuis la DB).
    slug_descriptions = {
        "salary": "salaire / revenu employeur",
        "invest_income": "revenus financiers / dividendes",
        "other_income": "autres revenus",
        "housing": "loyer / charges copropriété / syndic",
        "utilities": "énergie / internet / téléphone",
        "insurance": "assurances",
        "subscriptions": "abonnements (streaming, logiciels...)",
        "groceries": "courses alimentaires / supermarché",
        "restaurants": "restaurants / fast-food / livraison repas",
        "transport": "transport (RATP, taxi, covoiturage...)",
        "fuel": "carburant",
        "health": "santé / pharmacie / médecin",
        "shopping": "shopping / vêtements / électronique",
        "leisure": "loisirs / cinéma / sport",
        "travel": "voyages / hôtel / avion",
        "children": "enfants / crèche / école",
        "education": "éducation / formation",
        "taxes": "impôts / taxes",
        "cash": "retrait DAB / espèces",
        "transfer": "virement interne",
        "savings": "épargne / livret",
        "investment": "investissement / bourse / PEA",
        "fees": "frais bancaires",
        "uncategorized": "non catégorisé / autre",
    }

    names = slug_names or {}
    categories_desc = "\n".join(
        f"- {slug}: {slug_descriptions.get(slug, names.get(slug, slug))}"
        for slug in sorted(valid_slugs)
    )

    def _line(i: int, tx: TxInput) -> str:
        # Indice « marchand normalisé » : libellé nettoyé des préfixes carte /
        # dates / références SEPA par le même normalizer que le moteur. Aide
        # le modèle sans changer le contrat (les clés restent les libellés bruts).
        try:
            merchant = normalize_label(tx.label).merchant
        except Exception:
            merchant = ""
        hint = f' [marchand: {merchant}]' if merchant and merchant.strip().lower() != tx.label.strip().lower() else ""
        return f'{i+1}. "{tx.label}" ({tx.amount:+.2f}€){hint}'

    tx_lines = "\n".join(_line(i, tx) for i, tx in enumerate(transactions))

    return f"""Tu es un assistant de catégorisation bancaire pour des relevés français.

Catégories disponibles :
{categories_desc}

Transactions à catégoriser (l'indice [marchand: …] est le libellé nettoyé, utilise-le pour identifier l'enseigne) :
{tx_lines}

Réponds UNIQUEMENT avec un objet JSON valide dont les clés sont les libellés BRUTS exacts des transactions (sans l'indice marchand) et les valeurs sont les slugs de catégorie.
Exemple : {{"SOHO PIZZA": "restaurants", "SNCF INTERNET": "transport"}}
Ne fournis aucune explication, uniquement le JSON."""


def _parse_ai_json(raw: str, valid_slugs: list[str]) -> dict[str, str]:
    """JSON → mapping validé. Tolère les code fences markdown (Claude sans
    json-mode) ; ne garde que les slugs réellement valides pour le foyer."""
    raw = raw.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    ai_map: dict = json.loads(raw)
    return {
        label: slug
        for label, slug in ai_map.items()
        if slug in valid_slugs
    }


def _categorize_with_ai(provider: str, transactions: list[TxInput], valid_slugs: list[str], slug_names: dict[str, str] | None = None) -> dict[str, str]:
    """Dispatch vers le provider choisi. Même prompt, même contrat JSON."""
    prompt = _build_prompt(transactions, valid_slugs, slug_names)
    if provider == "openai":
        raw = _call_openai(prompt)
    else:
        raw = _call_anthropic(prompt)
    return _parse_ai_json(raw, valid_slugs)


def _call_anthropic(prompt: str) -> str:
    """Wrapper fin (monkeypatché par les tests) → services.llm."""
    from app.services.llm import call_anthropic
    return call_anthropic(prompt, model=settings.AI_MODEL_CATEGORIZE)


def _call_openai(prompt: str) -> str:
    """Wrapper fin (monkeypatché par les tests) → services.llm."""
    from app.services.llm import call_openai
    return call_openai(prompt, model=settings.AI_MODEL_CATEGORIZE_OPENAI)

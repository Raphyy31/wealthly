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
    choix : Anthropic (Claude Haiku) ou OpenAI (gpt-4o-mini par défaut),
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
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Category
from app.config import settings
from app.rate_limit import limiter
from app.categorization import categorize_transaction, normalize_label

router = APIRouter(prefix="/categorize", tags=["categorize"])

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


def _ai_provider() -> str | None:
    """Résout le provider LLM effectif selon AI_PROVIDER + clés posées.

    "auto" (défaut) : Anthropic prioritaire (comportement historique), sinon
    OpenAI si sa clé est présente. Forcer "anthropic"/"openai" ne bascule
    JAMAIS silencieusement sur l'autre — sans clé, l'IA est indisponible
    (fallback déterministe "uncategorized", comme avant).
    """
    pref = settings.AI_PROVIDER
    if pref == "anthropic":
        return "anthropic" if settings.ANTHROPIC_API_KEY else None
    if pref == "openai":
        return "openai" if settings.OPENAI_API_KEY else None
    # auto
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.OPENAI_API_KEY:
        return "openai"
    return None


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
    provider = _ai_provider()
    ai_available = provider is not None

    # ── Pass 2 : LLM (Claude Haiku ou OpenAI) pour les libellés que le
    # moteur ne résout pas — bloqué si plafond mensuel atteint. Le plafond
    # ai_budget s'applique quel que soit le provider.
    from app.services.ai_budget import under_cap, record_use
    if unmatched and provider and under_cap(db, current_user.household_id):
        try:
            ai_results = _categorize_with_ai(provider, unmatched, list(valid_slugs), slug_names)
            for label, slug in ai_results.items():
                results[label] = slug
                sources[label] = "llm"
            ai_used = True
            record_use(db, current_user.household_id)
        except Exception:
            # Fallback: mark remaining as uncategorized
            for tx in unmatched:
                if tx.label not in results:
                    results[tx.label] = "uncategorized"
    else:
        for tx in unmatched:
            if tx.label not in results:
                results[tx.label] = "uncategorized"

    # Le moteur crée des payees à la volée (db.flush) pendant la résolution
    # builtin — on les persiste pour que les prochaines résolutions (et la
    # couche learning) s'appuient dessus.
    db.commit()

    return CategorizeResponse(results=results, sources=sources, ai_used=ai_used, ai_available=ai_available)


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
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=settings.AI_MODEL_CATEGORIZE,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def _call_openai(prompt: str) -> str:
    """Appel OpenAI via l'API REST chat/completions (httpx, déjà dépendance —
    pas de SDK à installer). response_format=json_object force un JSON valide
    (le prompt mentionne « JSON », prérequis du json-mode)."""
    import httpx

    resp = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.AI_MODEL_CATEGORIZE_OPENAI,
            "messages": [{"role": "user", "content": prompt}],
            "max_completion_tokens": 1024,
            "response_format": {"type": "json_object"},
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]

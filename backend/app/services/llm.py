"""Service LLM partagé — résolution du provider + appels bruts.

Un seul endroit pour la logique « quelle clé, quel provider » et pour les
appels HTTP aux deux APIs. Consommé par routers/categorize.py (catégorisation
batch) et routers/insights.py (coach personnel).

Contrat : chaque fonction call_* prend un prompt utilisateur unique et
renvoie le texte brut de la réponse (le parsing JSON reste chez l'appelant,
qui connaît son schéma).
"""
from app.config import settings


def resolve_provider() -> str | None:
    """Provider LLM effectif selon AI_PROVIDER + clés posées.

    "auto" (défaut) : Anthropic prioritaire (comportement historique), sinon
    OpenAI si sa clé est présente. Forcer "anthropic"/"openai" ne bascule
    JAMAIS silencieusement sur l'autre — sans clé, l'IA est indisponible.
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


def call_anthropic(prompt: str, model: str, max_tokens: int = 1024) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def call_openai(prompt: str, model: str, max_tokens: int = 1024, json_mode: bool = True) -> str:
    """Appel OpenAI via l'API REST chat/completions (httpx, déjà dépendance —
    pas de SDK à installer). json_mode force un objet JSON valide (le prompt
    doit mentionner « JSON », prérequis du mode)."""
    import httpx

    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_completion_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    resp = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]

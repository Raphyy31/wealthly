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


# Modèle OpenAI validé pour ce process (évite de re-payer les 403 model_not_found
# à chaque appel). Reset naturel au redémarrage (Railway redéploie à chaque
# changement de variable, donc jamais obsolète longtemps).
_OPENAI_WORKING_MODEL: str | None = None


def _openai_candidates(requested: str) -> list[str]:
    """Modèle demandé d'abord, puis chaîne de repli (BYOK : le catalogue varie
    selon l'âge du compte / les restrictions de la clé — cf. incident prod
    2026-07-03 : gpt-4o-mini indisponible → 403 model_not_found)."""
    fallbacks = [m.strip() for m in settings.OPENAI_MODEL_FALLBACKS.split(",") if m.strip()]
    out: list[str] = []
    for m in [requested, *fallbacks]:
        if m and m not in out:
            out.append(m)
    return out


def call_openai(prompt: str, model: str, max_tokens: int = 1024, json_mode: bool = True) -> str:
    """Appel OpenAI via l'API REST chat/completions (httpx, déjà dépendance —
    pas de SDK à installer). json_mode force un objet JSON valide (le prompt
    doit mentionner « JSON », prérequis du mode). Sur 403/404 model_not_found,
    replie automatiquement sur la chaîne OPENAI_MODEL_FALLBACKS et mémorise le
    modèle qui fonctionne pour la durée du process."""
    import logging

    import httpx

    global _OPENAI_WORKING_MODEL
    logger = logging.getLogger("yotori.llm")

    candidates = _openai_candidates(_OPENAI_WORKING_MODEL or model)
    last_exc: Exception | None = None
    for candidate in candidates:
        body = {
            "model": candidate,
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
        if resp.status_code in (403, 404):
            # Modèle inaccessible pour CE compte/clé → candidat suivant.
            try:
                err_code = (resp.json().get("error") or {}).get("code") or ""
            except Exception:
                err_code = ""
            if "model" in err_code or resp.status_code == 404:
                logger.warning("[llm] openai model '%s' indisponible (%s %s) — repli suivant", candidate, resp.status_code, err_code)
                last_exc = httpx.HTTPStatusError(f"{resp.status_code} {err_code}", request=resp.request, response=resp)
                continue
        resp.raise_for_status()
        data = resp.json()
        if candidate != _OPENAI_WORKING_MODEL:
            logger.info("[llm] openai model retenu pour ce process : %s", candidate)
            _OPENAI_WORKING_MODEL = candidate
        return data["choices"][0]["message"]["content"]

    # Aucun candidat accessible — propage la dernière erreur pour ai_error.
    raise last_exc if last_exc else RuntimeError("openai: aucun modèle accessible")

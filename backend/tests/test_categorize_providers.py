"""Tests du sélecteur de provider IA pour /categorize (Anthropic vs OpenAI).

Aucun appel réseau : les fonctions _call_openai/_call_anthropic sont
monkeypatchées ; on vérifie la logique de sélection AI_PROVIDER + le
contrat de bout en bout (ai_used / ai_available / mapping validé).
"""
import pytest

from app.config import settings
from app.routers import categorize as cat_mod


@pytest.fixture(autouse=True)
def _reset_ai_settings(monkeypatch):
    """Chaque test part d'un état sans clé, provider auto."""
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None, raising=False)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None, raising=False)
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto", raising=False)
    yield


# ─── _ai_provider : logique de sélection ────────────────────────────────────

def test_provider_none_without_keys():
    assert cat_mod._ai_provider() is None


def test_provider_auto_prefers_anthropic(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-x", raising=False)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-x", raising=False)
    assert cat_mod._ai_provider() == "anthropic"


def test_provider_auto_falls_back_to_openai(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-x", raising=False)
    assert cat_mod._ai_provider() == "openai"


def test_provider_forced_openai(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai", raising=False)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-x", raising=False)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-x", raising=False)
    assert cat_mod._ai_provider() == "openai"


def test_provider_forced_without_key_is_unavailable(monkeypatch):
    # Forcer un provider sans sa clé ne bascule PAS silencieusement sur l'autre.
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai", raising=False)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-x", raising=False)
    assert cat_mod._ai_provider() is None


# ─── /categorize bout en bout (LLM mocké) ───────────────────────────────────

WEIRD_LABEL = "ZZZ MERCHANT INCONNU 42"  # ne matche aucune règle regex


def test_categorize_unavailable_without_keys(client, auth_headers):
    resp = client.post("/categorize", json={
        "transactions": [{"label": WEIRD_LABEL, "amount": -12.0}],
    }, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_available"] is False
    assert body["ai_used"] is False
    assert body["results"][WEIRD_LABEL] == "uncategorized"


def test_categorize_resolves_via_engine_without_ai(client, auth_headers):
    """Refonte moteur unique : un libellé brut (préfixe carte + date) doit être
    résolu par le moteur canonique (normalize + builtin rules) SANS IA, avec
    la source exposée — même résolution que l'import CSV."""
    label = "PAIEMENT PAR CARTE X8987 FRANPRIX LEVALLOIS 12/04"
    resp = client.post("/categorize", json={
        "transactions": [{"label": label, "amount": -23.4}],
    }, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_used"] is False
    slug = body["results"][label]
    assert slug not in ("uncategorized", None)
    assert "groceries" in slug  # groceries ou sous-catégorie groceries_super
    assert body["sources"][label] == "builtin_rule"


def test_categorize_uses_openai_when_selected(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-test", raising=False)
    calls = {}

    def fake_openai(prompt):
        calls["prompt"] = prompt
        return '{"%s": "shopping"}' % WEIRD_LABEL

    def boom(prompt):  # Anthropic ne doit PAS être appelé
        raise AssertionError("anthropic ne devrait pas être appelé")

    monkeypatch.setattr(cat_mod, "_call_openai", fake_openai)
    monkeypatch.setattr(cat_mod, "_call_anthropic", boom)

    resp = client.post("/categorize", json={
        "transactions": [{"label": WEIRD_LABEL, "amount": -12.0}],
    }, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_available"] is True
    assert body["ai_used"] is True
    assert body["results"][WEIRD_LABEL] == "shopping"
    # Le prompt embarque bien le libellé + les catégories du foyer
    assert WEIRD_LABEL in calls["prompt"]
    assert "restaurants" in calls["prompt"]


def test_categorize_openai_invalid_slug_filtered(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-test", raising=False)
    monkeypatch.setattr(cat_mod, "_call_openai", lambda p: '{"%s": "not_a_real_slug"}' % WEIRD_LABEL)

    resp = client.post("/categorize", json={
        "transactions": [{"label": WEIRD_LABEL, "amount": -12.0}],
    }, headers=auth_headers)
    body = resp.json()
    # Slug invalide filtré → la tx retombe hors mapping IA ; ai_used reste
    # vrai (l'appel a eu lieu) mais aucune catégorie fantaisiste ne passe.
    assert body["results"].get(WEIRD_LABEL) != "not_a_real_slug"


def test_categorize_openai_error_falls_back(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-test", raising=False)

    def broken(prompt):
        raise RuntimeError("500 from OpenAI")

    monkeypatch.setattr(cat_mod, "_call_openai", broken)
    resp = client.post("/categorize", json={
        "transactions": [{"label": WEIRD_LABEL, "amount": -12.0}],
    }, headers=auth_headers)
    body = resp.json()
    assert body["ai_used"] is False
    assert body["results"][WEIRD_LABEL] == "uncategorized"

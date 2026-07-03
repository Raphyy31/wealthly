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


# ─── Coach personnel (/ai/insights) : provider OpenAI ───────────────────────

def test_coach_uses_openai_when_selected(client, auth_headers, monkeypatch):
    """Le coach passe par OpenAI quand c'est le provider résolu (json mocké)."""
    from app.services import llm as llm_mod

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-test", raising=False)
    calls = {}

    def fake_openai(prompt, model, max_tokens=1024, json_mode=True):
        calls["model"] = model
        calls["prompt_has_snapshot"] = "patrimoine_net" in prompt
        return '{"coach": [{"title": "Cap", "body": "Vous épargnez bien."}], "alerts": []}'

    def boom(prompt, model, max_tokens=1024):
        raise AssertionError("anthropic ne devrait pas être appelé")

    monkeypatch.setattr(llm_mod, "call_openai", fake_openai)
    monkeypatch.setattr(llm_mod, "call_anthropic", boom)

    resp = client.post("/ai/insights", json={
        "currency": "EUR", "net_worth": 10000, "savings_rate_pct": 22.0,
        "force": True,
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ai_used"] is True
    assert body["ai_available"] is True
    assert body["coach"][0]["body"] == "Vous épargnez bien."
    assert calls["model"] == settings.AI_MODEL_COACH_OPENAI
    assert calls["prompt_has_snapshot"] is True


def test_coach_openai_error_falls_back_deterministic(client, auth_headers, monkeypatch):
    from app.services import llm as llm_mod

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-proj-test", raising=False)
    monkeypatch.setattr(llm_mod, "call_openai", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

    resp = client.post("/ai/insights", json={
        "currency": "EUR", "net_worth": 5000, "savings_rate_pct": 25.0,
        "force": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_used"] is False          # fallback déterministe
    assert body["ai_available"] is True      # la clé existe pourtant
    assert any("épargnez" in c["body"] for c in body["coach"])  # vouvoiement


# ─── /categorize/engine : passe gratuite automatique ────────────────────────

def _make_account(client, auth_headers):
    resp = client.post("/accounts", json={
        "name": "Compte test engine", "bank": "Test", "type": "checking",
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_engine_pass_heals_uncategorized_after_new_rule(client, auth_headers):
    """Une tx importée inconnue reste 'uncategorized' ; l'utilisateur crée une
    règle ; la passe gratuite la re-catégorise SANS IA (cat_source=user_rule)."""
    acc = _make_account(client, auth_headers)
    resp = client.post("/transactions", json={
        "account_id": acc, "date": "2026-06-15",
        "label": "XKQZ BOUTIQUE 42", "amount": -30.0,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    tx_id = resp.json()["id"]
    assert resp.json()["category_slug"] in (None, "uncategorized")

    # Règle custom créée APRÈS coup — le moteur doit soigner l'historique.
    resp = client.post("/rules", json={
        "pattern": "XKQZ", "category_slug": "shopping",
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text

    resp = client.post("/categorize/engine", json={}, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["updated"] >= 1
    hit = next(r for r in body["results"] if r["id"] == tx_id)
    assert hit["category_slug"] == "shopping"
    assert hit["cat_source"] == "user_rule"

    # Idempotence : une 2e passe ne retouche plus cette tx.
    resp2 = client.post("/categorize/engine", json={}, headers=auth_headers)
    assert all(r["id"] != tx_id for r in resp2.json()["results"])


def test_engine_pass_respects_manual_lock(client, auth_headers):
    """Une catégorie choisie explicitement (verrouillée) n'est JAMAIS réécrite
    par la passe gratuite, même si une règle matche le libellé."""
    acc = _make_account(client, auth_headers)
    resp = client.post("/transactions", json={
        "account_id": acc, "date": "2026-06-16",
        "label": "WQJX GALERIE 7", "amount": -50.0,
        "category_slug": "uncategorized", "is_manual_category": True,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    tx_id = resp.json()["id"]

    client.post("/rules", json={
        "pattern": "WQJX", "category_slug": "leisure",
    }, headers=auth_headers)

    resp = client.post("/categorize/engine", json={}, headers=auth_headers)
    assert resp.status_code == 200
    assert all(r["id"] != tx_id for r in resp.json()["results"])

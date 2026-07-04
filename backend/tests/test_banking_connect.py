"""Tests du flux de connexion GoCardless — anti-duplicats + robustesse.

GoCardless est mocké (banking._gc) : aucun appel réseau. Couvre le bug user
2026-07-03 : « 4 fois la même banque non synchronisée » (une ligne pending
créée à chaque clic, jamais nettoyée).
"""
import pytest

from app.routers import banking as banking_mod


@pytest.fixture()
def gc_mock(monkeypatch):
    """Mock _gc : institution caps + agreement + requisition, avec compteur."""
    calls = {"institutions": 0, "agreements": 0, "requisitions": 0}

    async def fake_gc(method, path, body=None):
        if path.startswith("/institutions/"):
            calls["institutions"] += 1
            return {"transaction_total_days": 90, "max_access_valid_for_days": 90}
        if path.startswith("/agreements/"):
            calls["agreements"] += 1
            return {"id": "agr-123"}
        if path.startswith("/requisitions/") and method == "POST":
            calls["requisitions"] += 1
            return {"id": f"req-{calls['requisitions']}", "link": "https://bank.example/consent"}
        raise AssertionError(f"appel GC inattendu: {method} {path}")

    monkeypatch.setattr(banking_mod, "_gc", fake_gc)
    # Cache process des caps : reset entre les tests
    monkeypatch.setattr(banking_mod, "_INST_CAPS_CACHE", {}, raising=False)
    return calls


def _connect(client, auth_headers, bank="BNP_BNPAFRPP"):
    return client.post("/banking/connect", json={
        "bank_name": bank, "bank_country": "FR",
    }, headers=auth_headers)


def _connections(client, auth_headers):
    resp = client.get("/banking/connections", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()


def test_connect_returns_redirect_and_creates_pending(client, auth_headers, gc_mock):
    resp = _connect(client, auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["redirect_url"].startswith("https://bank.example/")
    conns = _connections(client, auth_headers)
    assert len(conns) == 1
    assert conns[0]["status"] == "pending"


def test_reclicks_do_not_stack_pending_duplicates(client, auth_headers, gc_mock):
    """4 clics sur la même banque = UNE seule connexion pending visible
    (les tentatives précédentes sont purgées à chaque relance)."""
    for _ in range(4):
        assert _connect(client, auth_headers).status_code == 200
    conns = _connections(client, auth_headers)
    pendings = [c for c in conns if c["status"] == "pending"]
    assert len(pendings) == 1


def test_pending_purge_scoped_to_same_bank(client, auth_headers, gc_mock):
    """Relancer la banque A ne supprime pas la tentative en cours banque B."""
    assert _connect(client, auth_headers, bank="BANQUE_A").status_code == 200
    assert _connect(client, auth_headers, bank="BANQUE_B").status_code == 200
    assert _connect(client, auth_headers, bank="BANQUE_A").status_code == 200
    conns = _connections(client, auth_headers)
    banks = sorted(c["bank_name"] for c in conns)
    assert banks == ["BANQUE_A", "BANQUE_B"]


def test_institution_caps_cached_between_connects(client, auth_headers, gc_mock):
    """Le 2e connect à la même banque n'interroge plus /institutions (cache
    process) — un aller-retour GoCardless de moins sur le chemin critique."""
    assert _connect(client, auth_headers).status_code == 200
    assert _connect(client, auth_headers).status_code == 200
    assert gc_mock["institutions"] == 1
    assert gc_mock["requisitions"] == 2  # une requisition par tentative, elle

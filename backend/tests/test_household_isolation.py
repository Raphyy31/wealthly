"""
Cross-household isolation tests.

Garde-fou : prouve que l'app filtre strictement par household_id sur tous les
endpoints "list", même sans RLS Postgres (les tests tournent en SQLite). Si
une route oublie de filtrer un jour, ces tests sautent.

NB : ces tests ne testent PAS Row Level Security elle-même (impossible en
SQLite). Ils testent le filtrage applicatif, qui est la 1re ligne de défense.
RLS Postgres est la defense-in-depth derrière, à valider manuellement contre
une vraie DB Postgres + un rôle NOBYPASSRLS (cf docs/RLS_ACTIVATION.md).
"""
import pytest


def _register(client, email, household_name):
    resp = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "longenough1",
            "full_name": email.split("@")[0].title(),
            "household_name": household_name,
        },
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture()
def two_households(client):
    """2 utilisateurs, 2 foyers distincts. Renvoie (headers_a, headers_b)."""
    a = _register(client, "alice@example.com", "Foyer Alice")
    b = _register(client, "bob@example.com", "Foyer Bob")
    return a, b


def test_accounts_isolated_between_households(client, two_households):
    """Bob crée un compte. Alice liste ses comptes : ne doit pas voir celui de Bob."""
    a, b = two_households
    resp = client.post("/accounts", json={"name": "Compte Bob", "bank": "BNP", "type": "checking"}, headers=b)
    assert resp.status_code in (200, 201), resp.text
    bob_account_id = resp.json()["id"]

    resp = client.get("/accounts", headers=a)
    assert resp.status_code == 200
    alice_account_ids = [a["id"] for a in resp.json()]
    assert bob_account_id not in alice_account_ids, "FUITE : Alice voit le compte de Bob !"


def test_member_create_does_not_leak_id_back_to_other_household(client, two_households):
    a, b = two_households
    resp = client.post("/members", json={"name": "Bob Junior"}, headers=b)
    assert resp.status_code in (200, 201)

    resp = client.get("/members", headers=a)
    assert resp.status_code == 200
    alice_member_names = [m["name"] for m in resp.json()]
    assert "Bob Junior" not in alice_member_names


def test_transactions_isolated(client, two_households):
    a, b = two_households
    # Bob crée un compte + une transaction.
    resp = client.post("/accounts", json={"name": "C Bob", "bank": "BNP", "type": "checking"}, headers=b)
    assert resp.status_code in (200, 201)
    acc_id = resp.json()["id"]
    resp = client.post(
        "/transactions",
        json={"account_id": acc_id, "date": "2026-01-01", "label": "VIREMENT BOB", "amount": 1234.56},
        headers=b,
    )
    assert resp.status_code in (200, 201), resp.text

    # Alice ne doit jamais voir cette transaction.
    resp = client.get("/transactions", headers=a)
    assert resp.status_code == 200
    alice_labels = [t["label"] for t in resp.json()]
    assert "VIREMENT BOB" not in alice_labels


def test_cross_household_get_by_id_returns_404(client, two_households):
    """Tentative d'accès direct à un objet d'un autre foyer (devine l'ID)."""
    a, b = two_households
    resp = client.post("/accounts", json={"name": "Privé Bob", "bank": "BNP", "type": "checking"}, headers=b)
    assert resp.status_code in (200, 201)
    bob_account_id = resp.json()["id"]

    # Alice essaie de SUPPRIMER le compte de Bob avec son ID. Doit échouer 404.
    resp = client.delete(f"/accounts/{bob_account_id}", headers=a)
    assert resp.status_code == 404, (
        f"FUITE : Alice a pu supprimer le compte de Bob (status {resp.status_code}) !"
    )

    # Le compte de Bob doit toujours exister côté Bob.
    resp = client.get("/accounts", headers=b)
    assert any(a["id"] == bob_account_id for a in resp.json()), "Le compte de Bob a été supprimé !"


def test_planned_events_isolated(client, two_households):
    """Régression : la vue Projection (events ponctuels) doit aussi être isolée."""
    a, b = two_households
    resp = client.post(
        "/planned-events",
        json={"label": "Impôts Bob", "amount": 4000, "direction": "out", "date": "2026-09-15"},
        headers=b,
    )
    assert resp.status_code in (200, 201), resp.text

    resp = client.get("/planned-events", headers=a)
    assert resp.status_code == 200
    alice_labels = [e["label"] for e in resp.json()]
    assert "Impôts Bob" not in alice_labels


def test_documents_isolated(client, two_households):
    """Coffre-fort : Alice ne doit pas lister les docs de Bob."""
    a, b = two_households
    # Upload simple (texte) côté Bob via multipart.
    files = {"file": ("bail-bob.txt", b"Contenu confidentiel du bail de Bob", "text/plain")}
    resp = client.post("/documents", files=files, data={"category": "bail"}, headers=b)
    assert resp.status_code in (200, 201), resp.text
    bob_doc_id = resp.json()["id"]

    resp = client.get("/documents", headers=a)
    assert resp.status_code == 200
    alice_doc_ids = [d["id"] for d in resp.json()]
    assert bob_doc_id not in alice_doc_ids, "FUITE : Alice voit le document de Bob !"

    # Et le download d'Alice sur l'ID de Bob doit retourner 404.
    resp = client.get(f"/documents/{bob_doc_id}/download", headers=a)
    assert resp.status_code == 404

"""Contrat de l'assistant de planification, sans aucun appel réseau."""
import json

from app.routers import ai_planner


def _enable(monkeypatch):
    monkeypatch.setattr(ai_planner, "_available", lambda: True)
    monkeypatch.setattr(ai_planner, "_can_use_ai", lambda db, household_id: True)
    monkeypatch.setattr(ai_planner, "record_use", lambda db, household_id: None)


def test_events_unavailable_without_provider(client, auth_headers, monkeypatch):
    monkeypatch.setattr(ai_planner, "_available", lambda: False)
    response = client.post("/ai/plan/events", json={"message": "Prime de 1000 € demain"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"available": False, "events": [], "note": "Assistant IA non configuré."}


def test_events_are_sanitized_and_limited_to_owned_accounts(client, auth_headers, monkeypatch):
    _enable(monkeypatch)
    created = client.post("/accounts", json={
        "name": "Compte courant",
        "type": "checking",
        "initial_balance": 0,
        "currency": "EUR",
    }, headers=auth_headers)
    assert created.status_code == 201, created.text
    account_id = created.json()["id"]
    seen = {}

    def fake_llm(prompt):
        seen["prompt"] = prompt
        return json.dumps({"events": [
            {"label": "Prime", "amount": -1500, "direction": "in", "date": "2026-09-20", "account_id": account_id},
            {"label": "Faux compte", "amount": 50, "direction": "out", "date": "date invalide", "account_id": "foreign-id"},
            {"label": "", "amount": 100, "direction": "in", "date": None, "account_id": None},
        ]})

    monkeypatch.setattr(ai_planner, "_call_llm", fake_llm)
    response = client.post("/ai/plan/events", json={
        "message": "Une prime et une dépense",
        "today": "2026-07-12",
        "accounts": [
            {"id": account_id, "name": "Nom client falsifié"},
            {"id": "foreign-id", "name": "Compte secret"},
        ],
    }, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["events"] == [
        {"label": "Prime", "amount": 1500.0, "direction": "in", "date": "2026-09-20", "account_id": account_id},
        {"label": "Faux compte", "amount": 50.0, "direction": "out", "date": None, "account_id": None},
    ]
    assert 'nom="Compte courant"' in seen["prompt"]
    assert "Nom client falsifié" not in seen["prompt"]
    assert "Compte secret" not in seen["prompt"]


def test_loan_accepts_zero_interest_and_normalizes_values(client, auth_headers, monkeypatch):
    _enable(monkeypatch)
    monkeypatch.setattr(ai_planner, "_call_llm", lambda prompt: json.dumps({
        "name": "Prêt auto",
        "type": "auto_loan",
        "initial_capital": -15000,
        "interest_rate": 0,
        "duration_months": 48,
        "monthly_payment": 312.5,
        "start_date": "2026-08-01",
    }))
    response = client.post("/ai/plan/loan", json={"message": "Prêt auto sans intérêt"}, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["loan"]["type"] == "auto_loan"
    assert body["loan"]["interest_rate"] == 0.0
    assert body["loan"]["initial_capital"] == 0.0
    assert body["note"] is not None


def test_invalid_llm_json_returns_actionable_note(client, auth_headers, monkeypatch):
    _enable(monkeypatch)
    monkeypatch.setattr(ai_planner, "_call_llm", lambda prompt: "pas du JSON")
    response = client.post("/ai/plan/loan", json={"message": "Mon prêt"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["loan"] is None
    assert "Reformulez" in response.json()["note"]

"""Regression tests for the post-consent GoCardless transaction sync."""
from datetime import datetime

import pytest
from fastapi import HTTPException

from app.models import BankConnection, Transaction, User
from app.routers import banking as banking_mod


def _authorized_connection(db_session, registered_user, accounts=None):
    user = db_session.query(User).filter(User.email == registered_user["email"]).one()
    conn = BankConnection(
        household_id=user.household_id,
        session_id="req-sync",
        bank_name="TEST_BANK",
        bank_country="FR",
        status="authorized",
        state="state-sync",
        accounts_data=accounts or [{"id": "gc-1", "name": "Compte test", "currency": "EUR"}],
    )
    db_session.add(conn)
    db_session.commit()
    return conn.id


def _transaction(transaction_id, label="Salaire"):
    return {
        "transactionId": transaction_id,
        "bookingDate": "2026-07-10",
        "transactionAmount": {"amount": "1250.00", "currency": "EUR"},
        "remittanceInformationUnstructured": label,
    }


def test_sync_caps_history_window_to_institution_limit(
    client, auth_headers, registered_user, db_session, monkeypatch,
):
    conn_id = _authorized_connection(db_session, registered_user)
    seen = {}

    async def fake_gc(method, path, body=None, params=None):
        if path == "/institutions/TEST_BANK/":
            return {"transaction_total_days": 30, "max_access_valid_for_days": 90}
        if path == "/accounts/gc-1/":
            return {"status": "READY"}
        if path == "/accounts/gc-1/balances/":
            return {"balances": []}
        if path == "/accounts/gc-1/transactions/":
            seen["date_from"] = params["date_from"]
            return {"transactions": {"booked": [_transaction("tx-1")], "pending": []}}
        raise AssertionError(f"unexpected GoCardless call: {method} {path}")

    monkeypatch.setattr(banking_mod, "_gc", fake_gc)
    monkeypatch.setattr(banking_mod, "_INST_CAPS_CACHE", {}, raising=False)

    response = client.post(
        f"/banking/sync/{conn_id}?days_back=90",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["history_days"] == 30
    assert payload["imported"] == 1
    requested_days = (datetime.utcnow().date() - datetime.fromisoformat(seen["date_from"]).date()).days
    assert 29 <= requested_days <= 31


def test_sync_reports_transaction_failure_instead_of_ready(
    client, auth_headers, registered_user, db_session, monkeypatch,
):
    conn_id = _authorized_connection(db_session, registered_user)

    async def fake_gc(method, path, body=None, params=None):
        if path == "/institutions/TEST_BANK/":
            return {"transaction_total_days": 90, "max_access_valid_for_days": 90}
        if path == "/accounts/gc-1/":
            return {"status": "READY"}
        if path == "/accounts/gc-1/balances/":
            return {"balances": []}
        if path == "/accounts/gc-1/transactions/":
            raise HTTPException(status_code=502, detail="Banque temporairement indisponible")
        raise AssertionError(f"unexpected GoCardless call: {method} {path}")

    monkeypatch.setattr(banking_mod, "_gc", fake_gc)
    monkeypatch.setattr(banking_mod, "_INST_CAPS_CACHE", {}, raising=False)

    response = client.post(f"/banking/sync/{conn_id}", headers=auth_headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["accounts_read"] == 0
    assert payload["last_synced_at"] is None
    assert payload["errors"]

    connections = client.get("/banking/connections", headers=auth_headers).json()
    stored = next(c for c in connections if c["id"] == conn_id)
    assert "Banque temporairement indisponible" in stored["error_message"]


def test_empty_initial_payload_stays_retryable_during_aggregation_grace_period(
    client, auth_headers, registered_user, db_session, monkeypatch,
):
    conn_id = _authorized_connection(db_session, registered_user)

    async def fake_gc(method, path, body=None, params=None):
        if path == "/institutions/TEST_BANK/":
            return {"transaction_total_days": 90, "max_access_valid_for_days": 30}
        if path == "/accounts/gc-1/":
            return {"status": "READY"}
        if path == "/accounts/gc-1/balances/":
            return {"balances": []}
        if path == "/accounts/gc-1/transactions/":
            return {"transactions": {"booked": [], "pending": []}}
        raise AssertionError(f"unexpected GoCardless call: {method} {path}")

    monkeypatch.setattr(banking_mod, "_gc", fake_gc)
    monkeypatch.setattr(banking_mod, "_INST_CAPS_CACHE", {}, raising=False)

    response = client.post(
        f"/banking/sync/{conn_id}?initial_sync=true",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "processing"
    assert payload["pending_accounts"] == ["Compte test"]
    assert payload["last_synced_at"] is None


def test_initial_retry_only_revisits_accounts_still_pending(
    client, auth_headers, registered_user, db_session, monkeypatch,
):
    conn_id = _authorized_connection(
        db_session,
        registered_user,
        accounts=[
            {"id": "gc-ready", "name": "Courant", "currency": "EUR"},
            {"id": "gc-late", "name": "Épargne", "currency": "EUR"},
        ],
    )
    phase = {"value": 1}

    async def fake_gc(method, path, body=None, params=None):
        if path == "/institutions/TEST_BANK/":
            return {"transaction_total_days": 90, "max_access_valid_for_days": 90}
        if phase["value"] == 2 and "gc-ready" in path:
            raise AssertionError("the completed sibling account must not consume quota again")
        if path == "/accounts/gc-ready/":
            return {"status": "READY"}
        if path == "/accounts/gc-ready/balances/":
            return {"balances": []}
        if path == "/accounts/gc-ready/transactions/":
            return {"transactions": {"booked": [_transaction("tx-ready")], "pending": []}}
        if path == "/accounts/gc-late/":
            return {"status": "PROCESSING" if phase["value"] == 1 else "READY"}
        if path == "/accounts/gc-late/balances/":
            return {"balances": []}
        if path == "/accounts/gc-late/transactions/":
            return {"transactions": {"booked": [_transaction("tx-late", "Prime")], "pending": []}}
        raise AssertionError(f"unexpected GoCardless call: {method} {path}")

    monkeypatch.setattr(banking_mod, "_gc", fake_gc)
    monkeypatch.setattr(banking_mod, "_INST_CAPS_CACHE", {}, raising=False)

    first = client.post(
        f"/banking/sync/{conn_id}?initial_sync=true",
        headers=auth_headers,
    ).json()
    assert first["status"] == "processing"
    assert first["imported"] == 1
    assert first["pending_accounts"] == ["Épargne"]

    phase["value"] = 2
    second = client.post(
        f"/banking/sync/{conn_id}?initial_sync=true",
        headers=auth_headers,
    ).json()
    assert second["status"] == "ready"
    assert second["imported"] == 1
    assert db_session.query(Transaction).count() == 2

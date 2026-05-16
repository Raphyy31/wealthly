"""Tests pour POST /transactions/recategorize-transfers.

L'endpoint re-passe le moteur de catégorisation v2 sur les transactions
existantes ayant is_transfer_override=NULL (pas de décision manuelle de
l'utilisateur). Flag celles dont le libellé matche une règle xfer.*.
Les overrides manuels (True OU False) ne sont JAMAIS touchés.

Régression cible : tx AMEX importées avant le 2026-05-16 (date d'arrivée
du moteur v2) qui sont restées avec is_transfer_override=NULL et polluent
le panneau Total période de Transactions.
"""
from datetime import date

import pytest
from app.models import Transaction, Account, User


@pytest.fixture()
def household_setup(client, auth_headers, db_session):
    """Crée un compte AMEX + retourne (account_id, household_id)."""
    resp = client.post(
        "/accounts",
        json={"name": "AMEX Gold", "bank": "American Express", "type": "credit"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    account_id = resp.json()["id"]
    # Récupère le household_id du user enregistré
    user = db_session.query(User).filter_by(email="alice@example.com").first()
    return account_id, user.household_id


def _insert_legacy_tx(db_session, household_id, account_id, *, tx_date, amount, label, override=None):
    """Insère une tx directement en DB pour simuler un import pré-v2
    (sans passer par /transactions/import qui aurait déjà appliqué l'engine).
    """
    tx = Transaction(
        household_id=household_id,
        account_id=account_id,
        date=tx_date,
        amount=amount,
        label=label,
        is_transfer_override=override,
        dedup_hash=f"legacy-{label}-{amount}-{tx_date.isoformat()}",
    )
    db_session.add(tx)
    db_session.commit()
    return tx.id


def test_recategorize_flags_amex_settlement(client, auth_headers, household_setup, db_session):
    """Une tx PRELEVEMENT AUTOMATIQUE avec is_transfer_override=NULL est flaggée True."""
    account_id, household_id = household_setup
    tx_id = _insert_legacy_tx(
        db_session, household_id, account_id,
        tx_date=date(2026, 4, 29), amount=1202.21,
        label="PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI",
        override=None,
    )

    resp = client.post("/transactions/recategorize-transfers", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["flagged"] >= 1
    assert body["scanned"] >= 1

    db_session.expire_all()
    refreshed = db_session.query(Transaction).filter_by(id=tx_id).first()
    assert refreshed.is_transfer_override is True


def test_recategorize_respects_manual_false_override(client, auth_headers, household_setup, db_session):
    """Une tx avec is_transfer_override=False (user a dit 'PAS un transfert') reste intacte."""
    account_id, household_id = household_setup
    tx_id = _insert_legacy_tx(
        db_session, household_id, account_id,
        tx_date=date(2026, 4, 29), amount=1202.21,
        label="PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI",
        override=False,
    )

    resp = client.post("/transactions/recategorize-transfers", headers=auth_headers)
    assert resp.status_code == 200

    db_session.expire_all()
    refreshed = db_session.query(Transaction).filter_by(id=tx_id).first()
    assert refreshed.is_transfer_override is False  # untouched


def test_recategorize_skips_non_transfer_tx(client, auth_headers, household_setup, db_session):
    """Une tx d'achat normal n'est PAS flaggée."""
    account_id, household_id = household_setup
    tx_id = _insert_legacy_tx(
        db_session, household_id, account_id,
        tx_date=date(2026, 5, 10), amount=-159.20,
        label="LA REDOUTE ROUBAIX",
        override=None,
    )

    resp = client.post("/transactions/recategorize-transfers", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # flagged peut être > 0 si d'autres tx PRELEVEMENT existent dans le foyer,
    # mais CETTE tx précise doit rester intouchée
    db_session.expire_all()
    refreshed = db_session.query(Transaction).filter_by(id=tx_id).first()
    assert refreshed.is_transfer_override is None  # toujours NULL


def test_recategorize_requires_auth(client):
    resp = client.post("/transactions/recategorize-transfers")
    assert resp.status_code == 401


def test_recategorize_idempotent(client, auth_headers, household_setup, db_session):
    """Deuxième appel : 0 flagged car les tx ont déjà override=True."""
    account_id, household_id = household_setup
    _insert_legacy_tx(
        db_session, household_id, account_id,
        tx_date=date(2026, 4, 29), amount=1202.21,
        label="PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI",
        override=None,
    )

    r1 = client.post("/transactions/recategorize-transfers", headers=auth_headers)
    assert r1.json()["flagged"] >= 1

    r2 = client.post("/transactions/recategorize-transfers", headers=auth_headers)
    assert r2.json()["flagged"] == 0  # rien à flagger, tout est déjà True

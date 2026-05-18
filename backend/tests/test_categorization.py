"""Tests du moteur de catégorisation v2 (Payees + Learning + 120 règles builtin).

Couvre :
- normalize_label : extraction merchant + flags
- engine : ordre de résolution 5 couches
- builtin rules : transports, courses, abos, transferts internes
- Category Learning : création auto de règle après LEARNING_THRESHOLD obs

Les fixtures s'appuient sur un foyer fraîchement créé via /auth/register —
le seed DEFAULT_CATEGORIES est appliqué automatiquement à la première requête.
"""
import pytest
from sqlalchemy.orm import Session

from app.categorization import categorize_transaction, normalize_label
from app.categorization.learning import on_transaction_recategorized, LEARNING_THRESHOLD
from app.models import (
    Account, Category, CategorisationRule, Payee, Transaction, User, Household,
)
from app.database import Base, get_db


# ─── Normalize ──────────────────────────────────────────────────────────────

def test_normalize_strips_card_prefix():
    n = normalize_label("Paiement par carte\nPAIEMENT PAR CARTE X8987 FRANPRIX LEVALLOIS 12/04")
    assert "FRANPRIX" in n.merchant
    assert "PAIEMENT PAR CARTE" not in n.merchant
    assert n.operation_type == "card_payment"


def test_normalize_strips_date_suffix():
    n = normalize_label("PAIEMENT PAR CARTE X1234 STARBUCKS PARIS 14/05")
    assert "14/05" not in n.merchant
    assert "STARBUCKS" in n.merchant


def test_normalize_extracts_sepa_creditor_id():
    n = normalize_label("PRELEVEMENT MAIF 79038 NIORT FR70ZZZ000884")
    assert n.sepa_creditor_id == "FR70ZZZ000884"
    assert "FR70ZZZ" not in n.merchant


def test_normalize_handles_accents():
    n = normalize_label("Prélèvement\nPRELEVEMENT ENGIE ÉLECTRICITÉ")
    assert "ELECTRICITE" in n.merchant or "ENGIE" in n.merchant  # accents stripped
    assert "É" not in n.merchant


def test_normalize_self_transfer_flag():
    n = normalize_label("VIREMENT EMIS WEB M.OU MME DARMON RAPHAEL")
    assert "SELF_TRANSFER" in n.flags


def test_normalize_loan_installment_flag():
    n = normalize_label("PRELEVEMENT ECHEANCE PRET 00000750858 ECHEANCE 10/05/2026")
    assert "LOAN_INSTALLMENT" in n.flags


# ─── Engine integration (via /transactions/import) ──────────────────────────

@pytest.fixture()
def setup_household(client, auth_headers):
    """Create an account so we can post transactions through the engine."""
    resp = client.post("/accounts", json={"name": "Compte courant", "bank": "Boursorama", "type": "checking"}, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _import_one(client, headers, account_id, label, amount=-10.0, date="2026-05-01"):
    """Bulk-import a single tx without pre-set category — engine decides."""
    resp = client.post("/transactions/import", json={
        "account_id": account_id,
        "transactions": [{"account_id": account_id, "date": date, "label": label, "amount": amount}],
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _last_tx(client, headers):
    txs = client.get("/transactions", headers=headers).json()
    return sorted(txs, key=lambda t: t.get("date", ""))[-1]


def test_engine_categorizes_netflix_via_builtin(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 NETFLIX.COM 12/04", -11.99)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "subs_video", f"Got {tx['category_slug']} for Netflix"
    assert tx["cat_source"] == "builtin_rule"
    assert tx["payee_name"] == "Netflix"


def test_engine_categorizes_uber_not_eats(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 UBER TRIP HELP UBER 12/04", -15.50)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "taxi_vtc"


def test_engine_categorizes_uber_eats_as_delivery(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 UBER * EATS PARIS 22/04", -24.30)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "resto_delivery"


def test_engine_categorizes_franprix(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 FRANPRIX LEVALLOIS P 14/05", -47.20)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "groceries_super"
    assert tx["payee_name"] == "Franprix"


def test_engine_flags_revolut_as_transfer(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 Revolut**4604* Paris 25/04", -100.00)
    tx = _last_tx(client, auth_headers)
    assert tx["is_transfer_override"] is True
    assert tx["cat_source"] == "builtin_rule"


def test_engine_flags_amex_settlement_as_transfer(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI", 1202.21)
    tx = _last_tx(client, auth_headers)
    assert tx["is_transfer_override"] is True


def test_engine_unknown_merchant_stays_uncategorized(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 BOKOBZA ETHEL NOA CO 14/05", -50.00)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] is None
    assert tx["cat_source"] == "unknown"


def test_engine_categorizes_edf_as_electricity(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PRELEVEMENT EDF MENSUALITE", -78.00)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "electricity_gas"


def test_engine_categorizes_cotisation_premium_as_fees(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "COTISATION Offre Premium", -15.30)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "fees"


# ─── C13 (2026-05-18) — Règles ajoutées depuis l'audit CSV utilisateur ──────

def test_engine_categorizes_echeance_pret_as_loan_student(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT ECHEANCE PRET 00000750858 ECHEANCE 10/05/2026 PRET 00000750858-00082147-10052026-1 GRE-000000000005775 FR41ZZZ119164",
                -275.55)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "loan_student"
    assert tx["cat_source"] == "builtin_rule"


def test_engine_categorizes_bnp_personal_finance_as_loan_consumer(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT BNP Paribas Personal Finance 42278135431101", -40.79)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "loan_consumer"
    assert tx["payee_name"] == "BNP Personal Finance"


def test_engine_categorizes_predica_as_insurance_life(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT PREDICA PREVOYANCE DIALOGUE DU C CREDIT AGRICOLE GARANTIE DECES",
                -4.78)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "insurance_life"
    assert tx["payee_name"] == "Predica"


def test_engine_categorizes_frais_incidents_as_fees(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT FRAIS IRREG.ET INCIDENTS 03/2026", -32.00)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "fees"


def test_engine_categorizes_interets_debiteurs_as_fees(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT Intérets débiteurs", -7.20)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "fees"


def test_engine_categorizes_helium_as_reimbursement(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "VIREMENT EN VOTRE FAVEUR HELIUM 202604643396 FM.HELIUM 202604643396", 60.00)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "reimbursements"
    assert tx["payee_name"] == "Helium"


def test_engine_flags_self_couple_transfer(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "VIREMENT EMIS WEB M.OU MME DARMON RAPHAEL", -3000.00)
    tx = _last_tx(client, auth_headers)
    assert tx["is_transfer_override"] is True
    assert tx["cat_source"] == "builtin_rule"


def test_engine_flags_amex_settlement_debit_side(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household,
                "PRELEVEMENT American Express Carte-France XXXX X57273 9XXXX",
                -1202.21)
    tx = _last_tx(client, auth_headers)
    assert tx["is_transfer_override"] is True
    assert tx["cat_source"] == "builtin_rule"


def test_engine_categorizes_anthropic_as_cloud(client, auth_headers, setup_household):
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 ANTHROPIC 25/02", -20.00)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "subs_cloud"


# ─── User rules priority ────────────────────────────────────────────────────

def test_user_rule_beats_builtin(client, auth_headers, setup_household):
    # User crée une règle "NETFLIX → fees" (absurde mais test la priorité)
    rule_resp = client.post("/rules", json={
        "pattern": "NETFLIX", "category_slug": "fees",
        "created_by": "user", "priority": 100,
    }, headers=auth_headers)
    assert rule_resp.status_code == 201, rule_resp.text
    _import_one(client, auth_headers, setup_household, "PAIEMENT PAR CARTE X1234 NETFLIX.COM 12/04", -11.99)
    tx = _last_tx(client, auth_headers)
    assert tx["category_slug"] == "fees"  # user_rule beats builtin
    assert tx["cat_source"] == "user_rule"


# ─── Category Learning ──────────────────────────────────────────────────────

def test_learning_creates_rule_after_threshold(client, auth_headers, setup_household):
    """Recatégoriser 2 tx Franprix (auto-cat builtin → 'groceries_super') vers
    'restaurants' devrait créer une learned_rule au 2e PUT.
    """
    # Import 3 tx Franprix → auto-cat en groceries_super avec payee_id résolu
    for i in range(3):
        _import_one(client, auth_headers, setup_household, f"FRANPRIX LEVALLOIS P {i} 14/05", -10.0, date=f"2026-05-{i+1:02d}")
    txs = client.get("/transactions", headers=auth_headers).json()
    fr_txs = [t for t in txs if "FRANPRIX" in t["label"]]
    assert len(fr_txs) == 3
    assert all(t["payee_id"] for t in fr_txs)

    # PUT #1 : 1ère recat manuelle vers 'restaurants' → pas encore de règle
    client.put(f"/transactions/{fr_txs[0]['id']}", json={
        "category_slug": "restaurants", "is_manual_category": True,
    }, headers=auth_headers)
    rules = client.get("/rules", headers=auth_headers).json()
    learned = [r for r in rules if r.get("created_by") == "learning"]
    assert len(learned) == 0, "No rule should exist after only 1 observation"

    # PUT #2 : 2e recat manuelle → seuil atteint, règle apprise créée
    resp = client.put(f"/transactions/{fr_txs[1]['id']}", json={
        "category_slug": "restaurants", "is_manual_category": True,
    }, headers=auth_headers)
    body = resp.json()
    assert body.get("learned_rule") is not None, "PUT should report learned_rule when threshold hit"
    assert body["learned_rule"]["payee_name"] == "Franprix"
    assert body["learned_rule"]["category_slug"] == "restaurants"

    rules = client.get("/rules", headers=auth_headers).json()
    learned = [r for r in rules if r.get("created_by") == "learning"]
    assert len(learned) == 1


def test_learning_no_rule_without_payee(client, auth_headers, setup_household):
    """Un libellé inconnu (pas de payee résolu) ne déclenche pas de learning."""
    _import_one(client, auth_headers, setup_household, "BOKOBZA ETHEL NOA CO 14/05", -50.0)
    _import_one(client, auth_headers, setup_household, "BOKOBZA ETHEL NOA CO 15/05", -50.0, date="2026-05-02")
    txs = [t for t in client.get("/transactions", headers=auth_headers).json() if "BOKOBZA" in t["label"]]
    assert all(t.get("payee_id") is None for t in txs)
    # Recatégorise les 2 — aucun learning car pas de payee
    for t in txs:
        client.put(f"/transactions/{t['id']}", json={
            "category_slug": "shopping", "is_manual_category": True,
        }, headers=auth_headers)
    rules = client.get("/rules", headers=auth_headers).json()
    assert all(r.get("created_by") != "learning" for r in rules)


# ─── Apply retroactively endpoint ───────────────────────────────────────────

def test_apply_retroactively_reclasses_history(client, auth_headers, setup_household):
    """Après création d'une règle apprise, /apply-retroactively reclasse les
    tx historiques du même payee non manuellement catégorisées.
    """
    # 4 tx Franprix : auto-cat en groceries_super
    for i in range(4):
        _import_one(client, auth_headers, setup_household, f"FRANPRIX LEVALLOIS P 14/05", -10.0, date=f"2026-04-{i+1:02d}")
    txs = [t for t in client.get("/transactions", headers=auth_headers).json() if "FRANPRIX" in t["label"]]
    assert len(txs) == 4

    # User recat les 2 premières en 'restaurants' → seuil 2 → learned rule créée
    client.put(f"/transactions/{txs[0]['id']}", json={"category_slug": "restaurants", "is_manual_category": True}, headers=auth_headers)
    resp = client.put(f"/transactions/{txs[1]['id']}", json={"category_slug": "restaurants", "is_manual_category": True}, headers=auth_headers)
    rule_id = resp.json()["learned_rule"]["rule_id"]

    # Apply retroactively → les 2 tx restantes (non manuelles) doivent passer en restaurants
    apply_resp = client.post(f"/transactions/rules/{rule_id}/apply-retroactively", headers=auth_headers)
    assert apply_resp.status_code == 200, apply_resp.text
    assert apply_resp.json()["updated"] >= 2

    # Recheck : toutes les tx Franprix sont maintenant en restaurants
    txs2 = [t for t in client.get("/transactions", headers=auth_headers).json() if "FRANPRIX" in t["label"]]
    assert all(t["category_slug"] == "restaurants" for t in txs2)

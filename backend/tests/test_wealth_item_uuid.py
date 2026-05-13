"""
Task 3 of the account/asset unification plan: the new nullable
`wealth_item_uuid` column on both Account and Asset must not break the
existing /accounts and /assets POST endpoints. The column is a backend
prep column — it stays NULL by default and is not part of the input
payload yet. These tests pin that contract.
"""


def test_account_create_succeeds_with_nullable_wealth_item_uuid(client, auth_headers):
    """Creating an Account works without specifying wealth_item_uuid (NULL default)."""
    resp = client.post(
        "/accounts",
        json={
            "name": "Test PEA",
            "bank": "Bourso",
            "type": "pea",
            "initial_balance": 0,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Test PEA"
    # wealth_item_uuid is a backend prep column — may or may not surface in
    # the response. The key assertion is that the create succeeds, i.e. the
    # column accepts the NULL default and doesn't break the existing schema.
    if "wealth_item_uuid" in body:
        assert body["wealth_item_uuid"] is None


def test_asset_create_succeeds_with_nullable_wealth_item_uuid(client, auth_headers):
    """Creating an Asset works without specifying wealth_item_uuid (NULL default)."""
    resp = client.post(
        "/assets",
        json={
            "name": "Test Livret",
            "type": "savings_account",
            "current_value": 1000,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Test Livret"
    if "wealth_item_uuid" in body:
        assert body["wealth_item_uuid"] is None

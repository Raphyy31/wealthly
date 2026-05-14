"""Tests for DCA plan endpoints — focused on the new executions map."""


def _create_plan(client, headers):
    resp = client.post(
        "/dca",
        json={
            "name": "DCA ETF Monde",
            "ticker": "CW8.PA",
            "amount": 300,
            "frequency": "monthly",
            "day_of_month": 1,
            "start_date": "2025-01-01",
            "target_years": 10,
            "expected_return": 7.0,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_plan_defaults_executions_to_empty(client, auth_headers):
    plan = _create_plan(client, auth_headers)
    assert plan["executions"] == {}


def test_set_executions_replaces_map(client, auth_headers):
    plan = _create_plan(client, auth_headers)
    resp = client.put(
        f"/dca/{plan['id']}/executions",
        json={"executions": {"2025-03": False, "2025-07": False}},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["executions"] == {"2025-03": False, "2025-07": False}

    # list reflects the change
    listed = client.get("/dca", headers=auth_headers).json()
    assert listed[0]["executions"] == {"2025-03": False, "2025-07": False}

    # replacing again overwrites (does not merge)
    resp = client.put(
        f"/dca/{plan['id']}/executions",
        json={"executions": {"2025-04": False}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["executions"] == {"2025-04": False}


def test_set_executions_rejects_bad_keys(client, auth_headers):
    plan = _create_plan(client, auth_headers)
    resp = client.put(
        f"/dca/{plan['id']}/executions",
        json={"executions": {"2025-13": False}},  # invalid month
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_set_executions_unknown_plan_returns_404(client, auth_headers):
    resp = client.put(
        "/dca/nonexistent-id/executions",
        json={"executions": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_set_executions_is_owner_only(client, auth_headers):
    plan = _create_plan(client, auth_headers)

    # Register a second user — different household
    other = client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "supersecret123", "full_name": "Bob", "household_name": "Foyer Bob"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    resp = client.put(
        f"/dca/{plan['id']}/executions",
        json={"executions": {"2025-03": False}},
        headers=other_headers,
    )
    assert resp.status_code == 404

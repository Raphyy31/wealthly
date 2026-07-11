def _mk(client, headers):
    m = client.post("/members", json={"name": "Moi", "role": "adult", "color": "#111"}, headers=headers)
    assert m.status_code in (200, 201), m.text
    member_id = m.json()["id"]
    a = client.post("/accounts", json={"name": "Compte courant", "bank": "BNP", "type": "checking", "initial_balance": 0, "member_ids": []}, headers=headers)
    assert a.status_code in (200, 201), a.text
    return member_id, a.json()["id"]


def test_put_member_ids_persists(client, auth_headers):
    member_id, acc_id = _mk(client, auth_headers)

    # Assigne le compte au membre via PUT (comme le fait updateAccount côté front)
    r = client.put(f"/accounts/{acc_id}", json={"member_ids": [member_id]}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["member_ids"] == [member_id], f"PUT response: {r.json()}"

    # Re-fetch (comme un refresh de page → GET /accounts)
    lst = client.get("/accounts", headers=auth_headers)
    assert lst.status_code == 200, lst.text
    acc = next(a for a in lst.json() if a["id"] == acc_id)
    assert acc["member_ids"] == [member_id], f"après refresh: {acc}"


def test_switch_account_from_adult_to_child_persists(client, auth_headers):
    adult = client.post(
        "/members", json={"name": "Éric", "role": "adult", "color": "#111"}, headers=auth_headers,
    ).json()
    child = client.post(
        "/members", json={"name": "Léa", "role": "child", "color": "#222"}, headers=auth_headers,
    ).json()
    account = client.post(
        "/accounts",
        json={"name": "Compte", "bank": "BNP", "type": "checking", "initial_balance": 0, "member_ids": [adult["id"]]},
        headers=auth_headers,
    ).json()

    changed = client.put(
        f"/accounts/{account['id']}", json={"member_ids": [child["id"]]}, headers=auth_headers,
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["member_ids"] == [child["id"]]

    refreshed = client.get("/accounts", headers=auth_headers).json()
    stored = next(item for item in refreshed if item["id"] == account["id"])
    assert stored["member_ids"] == [child["id"]]


def test_put_rejects_unknown_member_instead_of_silently_dropping_it(client, auth_headers):
    _, account_id = _mk(client, auth_headers)
    response = client.put(
        f"/accounts/{account_id}", json={"member_ids": ["member-stale"]}, headers=auth_headers,
    )
    assert response.status_code == 422
    assert "titulaires" in response.json()["detail"]

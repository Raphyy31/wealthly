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

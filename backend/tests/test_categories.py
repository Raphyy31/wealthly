"""Gestion sûre des catégories incluses et personnalisées."""


def test_default_category_can_be_updated_but_not_deleted(client, auth_headers):
    categories = client.get("/categories", headers=auth_headers).json()
    default = next(category for category in categories if category["slug"] == "groceries")

    updated = client.put(
        "/categories/groceries",
        json={"kind": "wants"},
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["kind"] == "wants"

    deleted = client.delete("/categories/groceries", headers=auth_headers)
    assert deleted.status_code == 400
    assert "pas la supprimer" in deleted.json()["detail"]


def test_custom_subcategory_can_be_deleted(client, auth_headers):
    created = client.post("/categories", json={
        "name": "Marché du dimanche",
        "type": "expense",
        "kind": "needs",
        "parent_slug": "groceries",
    }, headers=auth_headers)
    assert created.status_code == 201, created.text

    deleted = client.delete(f"/categories/{created.json()['slug']}", headers=auth_headers)
    assert deleted.status_code == 204, deleted.text

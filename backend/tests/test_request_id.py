def test_every_response_has_a_request_reference(client):
    response = client.get("/health")

    assert response.status_code == 200
    request_id = response.headers.get("x-request-id")
    assert request_id
    assert len(request_id) == 12


def test_error_responses_also_have_a_request_reference(client):
    response = client.get("/route-that-does-not-exist")

    assert response.status_code == 404
    assert response.headers.get("x-request-id")

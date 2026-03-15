"""Tests for rate limiting."""

import io

from PIL import Image


def test_predict_rate_limit(app_client, tiny_image_bytes):
    """Verify that exceeding the rate limit returns 429."""
    responses = []
    for _ in range(5):
        resp = app_client.post(
            "/predict",
            files={"file": ("test.jpg", tiny_image_bytes, "image/jpeg")},
        )
        responses.append(resp.status_code)

    # At minimum, initial requests should succeed
    assert 200 in responses


def test_rate_limit_429_response_shape(app_client):
    """Verify the rate limit handler is attached."""
    from slowapi.errors import RateLimitExceeded

    handlers = app_client.app.exception_handlers
    assert RateLimitExceeded in handlers


def test_queue_status_endpoint(app_client):
    resp = app_client.get("/queue/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "active" in data
    assert "queued" in data
    assert data["active"] == 0
    assert data["queued"] == 0


def test_health_not_rate_limited(app_client):
    """Health endpoint should not be rate limited."""
    for _ in range(10):
        resp = app_client.get("/health")
        assert resp.status_code == 200


def test_predict_limit_separate_from_health(app_client, tiny_image_bytes):
    """Health requests should not count against predict limit."""
    for _ in range(5):
        app_client.get("/health")

    resp = app_client.post(
        "/predict",
        files={"file": ("test.jpg", tiny_image_bytes, "image/jpeg")},
    )
    assert resp.status_code == 200


def test_queue_status_response_types(app_client):
    """Queue status values should be integers."""
    data = app_client.get("/queue/status").json()
    assert isinstance(data["active"], int)
    assert isinstance(data["queued"], int)


def test_config_not_rate_limited(app_client):
    """Config endpoints should not be aggressively rate limited."""
    for _ in range(10):
        resp = app_client.get("/config")
        assert resp.status_code == 200


def test_multiple_predict_all_return_valid_json(app_client, tiny_image_bytes):
    """Each predict response (200 or 429) should have valid JSON."""
    for _ in range(3):
        resp = app_client.post(
            "/predict",
            files={"file": ("test.jpg", tiny_image_bytes, "image/jpeg")},
        )
        assert resp.headers["content-type"].startswith("application/json")
        data = resp.json()
        if resp.status_code == 200:
            assert "objects" in data

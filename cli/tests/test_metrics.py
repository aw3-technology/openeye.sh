"""Tests for Prometheus metrics endpoints."""


def test_metrics_endpoint_returns_prometheus_text(app_client):
    resp = app_client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers[
        "content-type"
    ] or "text/plain" in resp.headers.get("content-type", "")
    body = resp.text
    # Should contain our custom metrics
    assert "openeye_model_info" in body


def test_request_count_increments(app_client, tiny_image_bytes):
    # Make a health request
    app_client.get("/health")
    app_client.get("/health")

    resp = app_client.get("/metrics")
    body = resp.text
    # Should have counted the health requests
    assert "openeye_requests_total" in body


def test_health_includes_uptime_and_model_loaded(app_client):
    resp = app_client.get("/health")
    data = resp.json()
    assert "uptime_seconds" in data
    assert "model_loaded" in data
    assert data["model_loaded"] is True
    assert data["uptime_seconds"] >= 0

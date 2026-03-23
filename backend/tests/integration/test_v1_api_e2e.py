"""End-to-end integration tests for the /v1 hosted inference API.

Tests authenticate via API key, hit model listing, run detection with a
mocked inference backend, and verify rate-limit headers + credit deduction
through the /v1/usage endpoint.

The actual ML model loading is mocked — everything else (auth, rate limiting,
usage logging) runs against the in-memory Supabase fake.
"""

from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from fleet.deps import get_credits_service, get_inference_service
from fleet.services.credits_service import CreditsService
from fleet.services.inference_service import InferenceService

from .conftest import TEST_USER_ID, InMemorySupabase

pytestmark = pytest.mark.integration


# ── Helpers ───────────────────────────────────────────────────────────


def _make_test_image(width: int = 64, height: int = 64, color: str = "red") -> bytes:
    """Create a small in-memory JPEG image for upload."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


def _make_detect_result(width: int = 64, height: int = 64) -> dict:
    return {
        "model": "yolov8",
        "objects": [
            {
                "label": "person",
                "confidence": 0.92,
                "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
            }
        ],
        "image": {"width": width, "height": height},
        "inference_ms": 12.5,
    }


def _make_depth_result(width: int = 64, height: int = 64) -> dict:
    return {
        "model": "depth-anything-v2",
        "depth_map": "iVBORw0KGgo=",  # stub base64
        "image": {"width": width, "height": height},
        "inference_ms": 25.0,
    }


def _make_describe_result(width: int = 64, height: int = 64) -> dict:
    return {
        "model": "gpt-4o",
        "description": "A red square on a white background.",
        "image": {"width": width, "height": height},
        "inference_ms": 350.0,
    }


def _mock_credits_service(balance: int = 500, deduct_ok: bool = True) -> MagicMock:
    """Create a mock CreditsService with configurable behavior."""
    svc = MagicMock(spec=CreditsService)
    svc.check_and_deduct = AsyncMock(return_value=deduct_ok)
    svc.get_balance = AsyncMock(return_value=balance)
    svc.refund = AsyncMock(return_value=True)
    svc.close = AsyncMock()
    return svc


def _mock_inference_service(
    detect_result: dict | None = None,
    depth_result: dict | None = None,
    describe_result: dict | None = None,
    detect_error: Exception | None = None,
) -> MagicMock:
    """Create a mock InferenceService with configurable results."""
    svc = MagicMock(spec=InferenceService)
    if detect_error:
        svc.detect = AsyncMock(side_effect=detect_error)
    else:
        svc.detect = AsyncMock(return_value=detect_result or _make_detect_result())
    svc.depth = AsyncMock(return_value=depth_result or _make_depth_result())
    svc.describe = AsyncMock(return_value=describe_result or _make_describe_result())
    return svc


@pytest.fixture()
def mock_credits():
    return _mock_credits_service()


@pytest.fixture()
def mock_inference():
    return _mock_inference_service()


@pytest.fixture()
def v1_client(fleet_app, fake_supabase, mock_credits, mock_inference) -> TestClient:
    """TestClient with API key auth + mocked credits/inference services."""
    from fleet.deps import ApiKeyContext, get_api_key_auth

    fleet_app.dependency_overrides[get_api_key_auth] = lambda: ApiKeyContext(
        user_id=TEST_USER_ID,
        api_key_id="ak-integ-1",
        key_prefix="oe_test_",
        scopes=["inference"],
        rate_limit=100,
    )
    fleet_app.dependency_overrides[get_credits_service] = lambda: mock_credits
    fleet_app.dependency_overrides[get_inference_service] = lambda: mock_inference

    return TestClient(fleet_app, raise_server_exceptions=False)


# ── Model Listing ────────────────────────────────────────────────────


class TestModelListing:
    def test_list_models(self, v1_client: TestClient):
        resp = v1_client.get("/v1/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert len(models) >= 3
        ids = {m["id"] for m in models}
        assert "yolov8" in ids
        assert "depth-anything-v2" in ids
        assert "gpt-4o" in ids

    def test_models_have_credit_costs(self, v1_client: TestClient):
        resp = v1_client.get("/v1/models")
        for model in resp.json():
            assert "credits_per_call" in model
            assert isinstance(model["credits_per_call"], int)
            assert model["credits_per_call"] > 0

    def test_model_has_expected_fields(self, v1_client: TestClient):
        resp = v1_client.get("/v1/models")
        for model in resp.json():
            for key in ("id", "name", "task", "credits_per_call", "description"):
                assert key in model


# ── Detection Endpoint ───────────────────────────────────────────────


class TestDetectEndpoint:
    def test_detect_success(self, v1_client: TestClient, mock_inference, fake_supabase):
        image_bytes = _make_test_image()

        resp = v1_client.post(
            "/v1/detect",
            files={"file": ("test.jpg", image_bytes, "image/jpeg")},
            data={"confidence": "0.5"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["model"] == "yolov8"
        assert len(body["objects"]) == 1
        assert body["objects"][0]["label"] == "person"
        assert "credits_used" in body
        assert "inference_ms" in body

        # Verify rate limit headers
        assert "x-ratelimit-limit" in resp.headers
        assert "x-ratelimit-remaining" in resp.headers
        assert "x-ratelimit-reset" in resp.headers

    def test_detect_insufficient_credits(self, fleet_app, fake_supabase, mock_inference):
        from fleet.deps import ApiKeyContext, get_api_key_auth

        credits_svc = _mock_credits_service(deduct_ok=False)
        fleet_app.dependency_overrides[get_api_key_auth] = lambda: ApiKeyContext(
            user_id=TEST_USER_ID, api_key_id="ak-integ-1",
            key_prefix="oe_test_", scopes=["inference"], rate_limit=100,
        )
        fleet_app.dependency_overrides[get_credits_service] = lambda: credits_svc
        fleet_app.dependency_overrides[get_inference_service] = lambda: mock_inference
        client = TestClient(fleet_app, raise_server_exceptions=False)

        resp = client.post(
            "/v1/detect",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
        )
        assert resp.status_code == 402

    def test_detect_refunds_on_inference_failure(self, fleet_app, fake_supabase):
        from fleet.deps import ApiKeyContext, get_api_key_auth

        credits_svc = _mock_credits_service()
        inference_svc = _mock_inference_service(detect_error=RuntimeError("Model crashed"))
        fleet_app.dependency_overrides[get_api_key_auth] = lambda: ApiKeyContext(
            user_id=TEST_USER_ID, api_key_id="ak-integ-1",
            key_prefix="oe_test_", scopes=["inference"], rate_limit=100,
        )
        fleet_app.dependency_overrides[get_credits_service] = lambda: credits_svc
        fleet_app.dependency_overrides[get_inference_service] = lambda: inference_svc
        client = TestClient(fleet_app, raise_server_exceptions=False)

        resp = client.post(
            "/v1/detect",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
        )
        assert resp.status_code == 500
        credits_svc.refund.assert_called_once()

    def test_detect_no_auth_returns_401(self, fleet_app, fake_supabase):
        """Without API key auth, /v1 endpoints should return 401."""
        from fleet.deps import get_api_key_auth

        # Remove the api_key_auth override so real auth logic runs
        if get_api_key_auth in fleet_app.dependency_overrides:
            del fleet_app.dependency_overrides[get_api_key_auth]

        bare_client = TestClient(fleet_app, raise_server_exceptions=False)
        resp = bare_client.post(
            "/v1/detect",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
        )
        assert resp.status_code == 401


# ── Depth Endpoint ───────────────────────────────────────────────────


class TestDepthEndpoint:
    def test_depth_success(self, v1_client: TestClient, mock_inference, fake_supabase):
        resp = v1_client.post(
            "/v1/depth",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["model"] == "depth-anything-v2"
        assert "depth_map" in body
        assert body["credits_used"] == 2


# ── Describe Endpoint ────────────────────────────────────────────────


class TestDescribeEndpoint:
    def test_describe_success(self, v1_client: TestClient, mock_inference, fake_supabase):
        resp = v1_client.post(
            "/v1/describe",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
            data={"prompt": "What is in this image?"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["model"] == "gpt-4o"
        assert "description" in body
        assert body["credits_used"] == 3

    def test_describe_prompt_too_long(self, v1_client: TestClient):
        long_prompt = "x" * 2500  # exceeds _MAX_PROMPT_LENGTH (2000)
        resp = v1_client.post(
            "/v1/describe",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
            data={"prompt": long_prompt},
        )
        assert resp.status_code == 400


# ── Usage Endpoint ───────────────────────────────────────────────────


class TestUsageEndpoint:
    def test_usage_returns_balance_and_stats(
        self, v1_client: TestClient, mock_credits, fake_supabase: InMemorySupabase
    ):
        # Seed some usage log rows
        fake_supabase.store.setdefault("api_usage_log", []).extend([
            {
                "id": "usage-1",
                "api_key_id": "ak-integ-1",
                "user_id": TEST_USER_ID,
                "endpoint": "/v1/detect",
                "model": "yolov8",
                "credits_used": 1,
                "inference_ms": 12.0,
                "status_code": 200,
                "created_at": "2026-03-22T10:00:00Z",
            },
            {
                "id": "usage-2",
                "api_key_id": "ak-integ-1",
                "user_id": TEST_USER_ID,
                "endpoint": "/v1/depth",
                "model": "depth-anything-v2",
                "credits_used": 2,
                "inference_ms": 25.0,
                "status_code": 200,
                "created_at": "2026-03-22T11:00:00Z",
            },
        ])

        resp = v1_client.get("/v1/usage?days=30")
        assert resp.status_code == 200
        body = resp.json()
        assert body["balance"] == 500
        assert body["total_requests"] >= 2
        assert body["total_credits_used"] >= 3
        assert "/v1/detect" in body["by_endpoint"]

    def test_usage_with_custom_days(
        self, v1_client: TestClient, mock_credits, fake_supabase: InMemorySupabase
    ):
        mock_credits.get_balance = AsyncMock(return_value=200)
        resp = v1_client.get("/v1/usage?days=7")
        assert resp.status_code == 200
        body = resp.json()
        assert body["balance"] == 200


# ── Image Validation ─────────────────────────────────────────────────


class TestImageValidation:
    def test_invalid_image_returns_400(self, v1_client: TestClient):
        resp = v1_client.post(
            "/v1/detect",
            files={"file": ("bad.txt", b"this is not an image", "image/jpeg")},
        )
        assert resp.status_code == 400


# ── Multi-step: Detect then check usage ──────────────────────────────


class TestDetectThenUsage:
    def test_detect_then_usage_reflects_call(
        self, v1_client: TestClient, mock_credits, mock_inference,
        fake_supabase: InMemorySupabase
    ):
        """Run detection, then verify /v1/usage reflects the API call."""
        # Make a detection call
        resp = v1_client.post(
            "/v1/detect",
            files={"file": ("test.jpg", _make_test_image(), "image/jpeg")},
        )
        assert resp.status_code == 200

        # The RateLimitService.log_usage inserts into api_usage_log
        # via the fake supabase, so it should be there now
        usage_rows = fake_supabase.dump("api_usage_log")
        detect_rows = [r for r in usage_rows if r.get("endpoint") == "/v1/detect"]
        assert len(detect_rows) >= 1

        # Check /v1/usage
        resp = v1_client.get("/v1/usage")
        assert resp.status_code == 200
        body = resp.json()
        assert body["balance"] == 500
        assert body["total_requests"] >= 1

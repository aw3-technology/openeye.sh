"""Shared fixtures for fleet CLI tests."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner


@pytest.fixture()
def fleet_runner(monkeypatch):
    """CliRunner with OPENEYE_TOKEN set."""
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")
    # Re-set module-level vars that were captured at import time
    monkeypatch.setattr("openeye_ai.commands.fleet._helpers._TOKEN", "test-token")
    return CliRunner()


@pytest.fixture()
def mock_request(monkeypatch):
    """Patch _request in fleet helpers and return the mock.

    Usage:
        mock = mock_request({"id": "abc", "api_key": "oek_xxx"})
        result = fleet_runner.invoke(app, ["fleet", "register", "cam-1"])
    """
    mock = MagicMock()

    def _factory(return_value: Any = None):
        if return_value is None:
            return_value = {}
        mock.return_value = return_value
        monkeypatch.setattr("openeye_ai.commands.fleet._helpers._request", mock)
        return mock

    return _factory


# ── Response factories ──────────────────────────────────────────


def make_device(**overrides) -> dict:
    base = {
        "id": "dev-001",
        "user_id": "user-1",
        "name": "cam-1",
        "device_type": "camera",
        "status": "online",
        "api_key": None,
        "hardware_specs": {},
        "tags": {},
        "config_overrides": {},
        "firmware_version": "1.0.0",
        "current_model_id": None,
        "current_model_version": None,
        "ip_address": "10.0.0.1",
        "last_heartbeat_at": "2025-01-01T00:00:00Z",
        "registered_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def make_deployment(**overrides) -> dict:
    base = {
        "id": "dep-001",
        "user_id": "user-1",
        "name": "yolov8-2.1",
        "model_id": "yolov8",
        "model_version": "2.1",
        "strategy": "canary",
        "status": "pending",
        "rollout_stages": [
            {"name": "canary", "percentage": 10, "min_wait_seconds": 300},
        ],
        "current_stage": 0,
        "target_device_ids": [],
        "target_group_id": None,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def make_group(**overrides) -> dict:
    base = {
        "id": "grp-001",
        "user_id": "user-1",
        "name": "Warehouse A Cameras",
        "description": "",
        "tag_filter": {},
        "auto_scaling_policy": None,
        "device_count": 3,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def make_alert(**overrides) -> dict:
    base = {
        "id": "alert-001",
        "user_id": "user-1",
        "device_id": "dev-001",
        "deployment_id": None,
        "alert_type": "device_offline",
        "severity": "warning",
        "title": "Device offline",
        "message": "No heartbeat in 5 minutes",
        "resolved": False,
        "resolved_at": None,
        "created_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def make_maintenance(**overrides) -> dict:
    base = {
        "id": "maint-001",
        "user_id": "user-1",
        "name": "Nightly Update",
        "description": "",
        "device_ids": [],
        "group_id": None,
        "starts_at": "2025-06-01T02:00:00Z",
        "ends_at": "2025-06-01T04:00:00Z",
        "recurrence": None,
        "is_active": True,
        "status": "upcoming",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base

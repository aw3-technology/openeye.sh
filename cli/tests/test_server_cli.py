"""Tests for server CLI commands (health, nebius-stats, config)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

import typer

# The server_cli module exports functions, not a Typer app.
# We build a small test app to invoke them.
from openeye_ai.commands.server_cli import health, nebius_stats, server_config_get, server_config_set

_app = typer.Typer()
_app.command("health")(health)
_app.command("nebius-stats")(nebius_stats)
_app.command("config-get")(server_config_get)
_app.command("config-set")(server_config_set)

runner = CliRunner()

_MODULE = "openeye_ai.commands.server_cli"


# ── health ───────────────────────────────────────────────────────────


def test_health_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "model": "yolov8",
        "loaded": True,
        "uptime": "2h 15m",
    }
    mock_resp.raise_for_status = MagicMock()

    # Also mock the queue status call
    mock_queue_resp = MagicMock()
    mock_queue_resp.status_code = 200
    mock_queue_resp.raise_for_status = MagicMock()
    mock_queue_resp.json.return_value = {"active": 2, "queued": 5}

    with (
        patch("httpx.request", return_value=mock_resp),
        patch("httpx.get", return_value=mock_queue_resp),
    ):
        result = runner.invoke(_app, ["health"])
    assert result.exit_code == 0
    assert "Healthy" in result.output
    assert "yolov8" in result.output


def test_health_connection_error():
    import httpx

    with patch("httpx.request", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(_app, ["health"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


def test_health_custom_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"model": "depth-anything", "loaded": True, "uptime": "1h"}
    mock_resp.raise_for_status = MagicMock()

    # Queue call may fail — that's ok, it's caught
    import httpx

    with (
        patch("httpx.request", return_value=mock_resp) as mock_req,
        patch("httpx.get", side_effect=httpx.ConnectError("no queue")),
    ):
        result = runner.invoke(_app, ["health", "--server", "http://myserver:9000"])
    assert result.exit_code == 0
    # Verify the URL was used
    call_url = mock_req.call_args[0][1]
    assert "myserver:9000" in call_url


def test_health_without_queue():
    """Health should succeed even if queue endpoint is unreachable."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"model": "yolov8", "loaded": False, "uptime": "5m"}
    mock_resp.raise_for_status = MagicMock()

    import httpx

    with (
        patch("httpx.request", return_value=mock_resp),
        patch("httpx.get", side_effect=Exception("queue down")),
    ):
        result = runner.invoke(_app, ["health"])
    assert result.exit_code == 0
    assert "Healthy" in result.output


# ── nebius-stats ─────────────────────────────────────────────────────


def test_nebius_stats_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "total_calls": 150,
        "total_tokens": 5000,
        "total_errors": 3,
        "avg_latency_ms": 45.2,
        "model": "Qwen/Qwen2.5-VL-3B",
        "by_model": {
            "Qwen/Qwen2.5-VL-3B": {"calls": 150, "tokens": 5000},
        },
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.request", return_value=mock_resp):
        result = runner.invoke(_app, ["nebius-stats"])
    assert result.exit_code == 0
    assert "150" in result.output
    assert "5000" in result.output
    assert "45.2" in result.output


def test_nebius_stats_connection_error():
    import httpx

    with patch("httpx.request", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(_app, ["nebius-stats"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


# ── server-config get ────────────────────────────────────────────────


def test_config_get_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "confidence_threshold": 0.25,
        "max_batch_size": 4,
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.request", return_value=mock_resp):
        result = runner.invoke(_app, ["config-get"])
    assert result.exit_code == 0
    assert "confidence_threshold" in result.output
    assert "0.25" in result.output


def test_config_get_connection_error():
    import httpx

    with patch("httpx.request", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(_app, ["config-get"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


# ── server-config set ────────────────────────────────────────────────


def test_config_set_json_value():
    """Setting a JSON value (number)."""
    mock_get_resp = MagicMock()
    mock_get_resp.status_code = 200
    mock_get_resp.json.return_value = {"confidence_threshold": 0.25, "max_batch_size": 4}
    mock_get_resp.raise_for_status = MagicMock()

    mock_put_resp = MagicMock()
    mock_put_resp.status_code = 200
    mock_put_resp.json.return_value = {}
    mock_put_resp.raise_for_status = MagicMock()

    with patch("httpx.request", side_effect=[mock_get_resp, mock_put_resp]) as mock_req:
        result = runner.invoke(_app, ["config-set", "confidence_threshold", "0.5"])
    assert result.exit_code == 0
    assert "Config updated" in result.output
    assert "confidence_threshold" in result.output

    # Verify PUT was called with updated config
    put_call = mock_req.call_args_list[1]
    assert put_call[1]["json"]["confidence_threshold"] == 0.5


def test_config_set_string_value():
    """Setting a plain string value (not JSON-parseable)."""
    mock_get_resp = MagicMock()
    mock_get_resp.status_code = 200
    mock_get_resp.json.return_value = {"model_name": "yolov8"}
    mock_get_resp.raise_for_status = MagicMock()

    mock_put_resp = MagicMock()
    mock_put_resp.status_code = 200
    mock_put_resp.json.return_value = {}
    mock_put_resp.raise_for_status = MagicMock()

    with patch("httpx.request", side_effect=[mock_get_resp, mock_put_resp]) as mock_req:
        result = runner.invoke(_app, ["config-set", "model_name", "depth-anything"])
    assert result.exit_code == 0
    assert "Config updated" in result.output

    put_call = mock_req.call_args_list[1]
    assert put_call[1]["json"]["model_name"] == "depth-anything"


def test_config_set_connection_error():
    import httpx

    with patch("httpx.request", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(_app, ["config-set", "key", "value"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output

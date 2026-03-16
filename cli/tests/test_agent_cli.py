"""Tests for agent CLI commands (User Stories 85-89)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from openeye_ai.commands.agent_cli import agent_app

runner = CliRunner()


# ── agent run ────────────────────────────────────────────────────────


def test_agent_run_model_not_downloaded():
    with patch("openeye_ai.registry.is_downloaded", return_value=False):
        result = runner.invoke(agent_app, ["run", "--model", "yolov8"])
    assert result.exit_code == 1
    assert "not downloaded" in result.output


def test_agent_run_success():
    adapter = MagicMock()
    camera = MagicMock()
    loop_instance = MagicMock()
    loop_instance.run.side_effect = KeyboardInterrupt

    with (
        patch("openeye_ai.registry.is_downloaded", return_value=True),
        patch("openeye_ai.registry.get_adapter", return_value=adapter),
        patch("openeye_ai.utils.camera.Camera", return_value=camera),
        patch("openeye_ai.agent.loop.AgentLoop", return_value=loop_instance),
    ):
        result = runner.invoke(agent_app, ["run", "--model", "yolov8", "--goal", "test"])
    assert result.exit_code == 0
    adapter.load.assert_called_once()
    loop_instance.on_tick.assert_called_once()


def test_agent_run_vlm_missing_openai():
    """When --vlm is set but openai is not installed, should print fallback and continue."""
    adapter = MagicMock()
    loop_instance = MagicMock()
    loop_instance.run.side_effect = KeyboardInterrupt

    with (
        patch("openeye_ai.registry.is_downloaded", return_value=True),
        patch("openeye_ai.registry.get_adapter", return_value=adapter),
        patch("openeye_ai.utils.camera.Camera", return_value=MagicMock()),
        patch("openeye_ai.agent.loop.AgentLoop", return_value=loop_instance),
        patch("openeye_ai.vlm.nebius.create_vlm_caller", side_effect=ImportError("no openai")),
    ):
        result = runner.invoke(agent_app, ["run", "--model", "yolov8", "--vlm"])
    assert result.exit_code == 0
    assert "VLM unavailable" in result.output


# ── agent start ──────────────────────────────────────────────────────


def test_agent_start_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "started", "goal": "monitor"}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_response):
        result = runner.invoke(agent_app, ["start", "--goal", "monitor"])
    assert result.exit_code == 0
    assert "started" in result.output


def test_agent_start_connection_error():
    import httpx

    with patch("httpx.post", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(agent_app, ["start"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


# ── agent stop ───────────────────────────────────────────────────────


def test_agent_stop_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "stopped", "ticks": 42}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_response):
        result = runner.invoke(agent_app, ["stop"])
    assert result.exit_code == 0
    assert "42" in result.output


# ── agent status ─────────────────────────────────────────────────────


def test_agent_status_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "running": True,
        "goal": "test goal",
        "ticks": 10,
        "current_plan": ["step 1"],
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_response):
        result = runner.invoke(agent_app, ["status"])
    assert result.exit_code == 0


def test_agent_status_connection_error():
    import httpx

    with patch("httpx.get", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(agent_app, ["status"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


# ── agent memory ─────────────────────────────────────────────────────


def test_agent_memory_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"tick": 1, "scene_summary": "person at desk", "change_description": "", "significance": 0.5, "tags": ["person"]},
    ]
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_response):
        result = runner.invoke(agent_app, ["memory"])
    assert result.exit_code == 0


def test_agent_memory_empty():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_response):
        result = runner.invoke(agent_app, ["memory"])
    assert result.exit_code == 0
    assert "No observations" in result.output


# ── agent recall ─────────────────────────────────────────────────────


def test_agent_recall_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"tick": 3, "scene_summary": "person holding tool", "tags": ["person", "tool"]},
    ]
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_response):
        result = runner.invoke(agent_app, ["recall", "person"])
    assert result.exit_code == 0


def test_agent_recall_no_results():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_response):
        result = runner.invoke(agent_app, ["recall", "nothing"])
    assert result.exit_code == 0
    assert "No matching" in result.output

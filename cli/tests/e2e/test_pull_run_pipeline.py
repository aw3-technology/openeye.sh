"""E2E tests for the pull → run → serve pipeline.

All tests are marked @pytest.mark.integration and excluded from CI
with `-m "not integration"`.
"""

from __future__ import annotations

import json
import time

import httpx
import pytest

from openeye_ai.cli import app as cli_app


pytestmark = pytest.mark.integration


def test_pull_yolov8(cli_runner, e2e_home):
    """Pull yolov8 via CLI and verify .pulled marker is created."""
    result = cli_runner.invoke(cli_app, ["pull", "yolov8"])
    assert result.exit_code == 0, result.output

    models_dir = e2e_home / "models" / "yolov8"
    assert (models_dir / ".pulled").exists()


def test_run_yolov8(cli_runner, e2e_home, test_image):
    """Pull then run yolov8 on a test image, validate JSON output."""
    # Pull first
    cli_runner.invoke(cli_app, ["pull", "yolov8"])

    # Run inference
    result = cli_runner.invoke(cli_app, ["run", "yolov8", str(test_image)])
    assert result.exit_code == 0, result.output

    # Parse JSON from output
    data = json.loads(result.output)
    assert "model" in data
    assert "objects" in data
    assert "inference_ms" in data
    assert data["model"] == "yolov8"


def test_list_shows_downloaded(cli_runner, e2e_home):
    """After pulling, `list` should show the model as downloaded."""
    # Pull first
    cli_runner.invoke(cli_app, ["pull", "yolov8"])

    result = cli_runner.invoke(cli_app, ["list"])
    assert result.exit_code == 0
    assert "downloaded" in result.output.lower() or "✓" in result.output


def test_serve_health(cli_runner, e2e_home):
    """Start the server and verify /health responds."""
    import multiprocessing

    def run_server():
        from typer.testing import CliRunner

        runner = CliRunner()
        runner.invoke(cli_app, ["serve", "yolov8", "--port", "18765"])

    # Pull first
    cli_runner.invoke(cli_app, ["pull", "yolov8"])

    proc = multiprocessing.Process(target=run_server, daemon=True)
    proc.start()

    try:
        # Wait for server to start
        for _ in range(30):
            try:
                resp = httpx.get("http://localhost:18765/health", timeout=1.0)
                if resp.status_code == 200:
                    data = resp.json()
                    assert data["status"] == "ok"
                    return
            except (httpx.ConnectError, httpx.ReadTimeout):
                time.sleep(1)

        pytest.fail("Server did not start within 30 seconds")
    finally:
        proc.terminate()
        proc.join(timeout=5)

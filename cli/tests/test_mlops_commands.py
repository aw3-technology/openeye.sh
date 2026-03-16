"""Tests for MLOps CLI commands (stories 69-84)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from openeye_ai.cli import app

runner = CliRunner()


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _isolate_mlops(tmp_openeye_home, monkeypatch):
    """Redirect all MLOps YAML paths to a temp dir."""
    home = tmp_openeye_home
    monkeypatch.setattr("openeye_ai.mlops.model_registry._ENTERPRISE_REGISTRY_PATH", home / "registry.yaml")
    monkeypatch.setattr("openeye_ai.mlops.lifecycle._PROMOTIONS_PATH", home / "promotions.yaml")
    monkeypatch.setattr("openeye_ai.mlops.ab_testing._AB_TESTS_PATH", home / "ab_tests.yaml")
    monkeypatch.setattr("openeye_ai.mlops.shadow_mode._SHADOW_PATH", home / "shadow_deployments.yaml")
    monkeypatch.setattr("openeye_ai.mlops.retraining._PIPELINES_PATH", home / "retraining_pipelines.yaml")
    monkeypatch.setattr("openeye_ai.mlops.retraining._RUNS_PATH", home / "retraining_runs.yaml")
    monkeypatch.setattr("openeye_ai.mlops.batch_inference._BATCH_JOBS_PATH", home / "batch_jobs.yaml")
    monkeypatch.setattr("openeye_ai.mlops.feedback._ANNOTATIONS_PATH", home / "annotations.yaml")
    monkeypatch.setattr("openeye_ai.mlops.feedback._BATCHES_PATH", home / "feedback_batches.yaml")


@pytest.fixture()
def model_file(tmp_path):
    """Create a fake .pt model file."""
    p = tmp_path / "custom-model.pt"
    p.write_bytes(b"\x00" * 1024)
    return p


@pytest.fixture()
def registered_model(model_file, tmp_openeye_home):
    """Upload a model to the registry and return the key."""
    result = runner.invoke(app, [
        "mlops", "upload", str(model_file),
        "--name", "Custom Model",
        "--key", "custom-model",
        "--format", "pytorch",
    ])
    assert result.exit_code == 0
    return "custom-model"


# ── Story 69: upload ──────────────────────────────────────────────────


class TestUpload:
    def test_upload_auto_detects_format(self, model_file, tmp_openeye_home):
        """openeye mlops upload custom-model.pt — auto-detect format and key."""
        result = runner.invoke(app, ["mlops", "upload", str(model_file)])
        assert result.exit_code == 0
        assert "Registered" in result.output
        assert "custom-model" in result.output

    def test_upload_with_explicit_flags(self, model_file, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "upload", str(model_file),
            "--name", "My Model",
            "--key", "my-model",
            "--format", "pytorch",
        ])
        assert result.exit_code == 0
        assert "My Model" in result.output

    def test_upload_missing_file(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "upload", "/tmp/nonexistent.pt"])
        assert result.exit_code == 1

    def test_upload_unknown_extension(self, tmp_path, tmp_openeye_home):
        p = tmp_path / "model.xyz"
        p.write_bytes(b"\x00" * 100)
        result = runner.invoke(app, ["mlops", "upload", str(p)])
        assert result.exit_code == 1
        assert "auto-detect" in result.output


# ── Story 70: registry ───────────────────────────────────────────────


class TestRegistry:
    def test_registry_empty(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "registry"])
        assert result.exit_code == 0
        assert "No models" in result.output

    def test_registry_with_model(self, registered_model):
        result = runner.invoke(app, ["mlops", "registry"])
        assert result.exit_code == 0
        assert "custom-model" in result.output


# ── Story 71: versions ──────────────────────────────────────────────


class TestVersions:
    def test_versions_shows_stages(self, registered_model):
        result = runner.invoke(app, ["mlops", "versions", "custom-model"])
        assert result.exit_code == 0
        assert "1.0.0" in result.output
        assert "dev" in result.output

    def test_versions_unknown_model(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "versions", "nonexistent"])
        assert result.exit_code == 1


# ── Story 72: promote ───────────────────────────────────────────────


class TestPromote:
    def test_promote_dev_to_staging(self, registered_model):
        result = runner.invoke(app, [
            "mlops", "promote",
            "--model", "custom-model",
            "--version", "1.0.0",
            "--from", "dev",
            "--to", "staging",
        ])
        assert result.exit_code == 0
        assert "dev" in result.output
        assert "staging" in result.output

    def test_promote_invalid_stage(self, registered_model):
        result = runner.invoke(app, [
            "mlops", "promote",
            "--model", "custom-model",
            "--version", "1.0.0",
            "--from", "dev",
            "--to", "invalid",
        ])
        assert result.exit_code == 1


# ── Story 73: approve-promotion ──────────────────────────────────────


class TestApprovePromotion:
    def test_approve_pending(self, registered_model):
        # First promote to staging (auto-approved by default gate)
        runner.invoke(app, [
            "mlops", "promote",
            "--model", "custom-model", "--version", "1.0.0",
            "--from", "dev", "--to", "staging",
        ])
        # Then request production (requires approval)
        runner.invoke(app, [
            "mlops", "promote",
            "--model", "custom-model", "--version", "1.0.0",
            "--from", "staging", "--to", "production",
        ])
        # Approve it
        result = runner.invoke(app, [
            "mlops", "approve-promotion",
            "--model", "custom-model", "--version", "1.0.0",
        ])
        assert result.exit_code == 0
        assert "approved" in result.output.lower()

    def test_approve_no_pending(self, registered_model):
        result = runner.invoke(app, [
            "mlops", "approve-promotion",
            "--model", "custom-model", "--version", "1.0.0",
        ])
        assert result.exit_code == 1


# ── Story 74: evaluate ───────────────────────────────────────────────


class TestEvaluate:
    def test_evaluate_model_not_downloaded(self, tmp_openeye_home, monkeypatch):
        monkeypatch.setattr("openeye_ai.commands.mlops.evaluate.is_downloaded", lambda m: False)
        result = runner.invoke(app, [
            "mlops", "evaluate", "yolov8", "--dataset", "val.json",
        ])
        assert result.exit_code == 1
        assert "not downloaded" in result.output

    def test_evaluate_dataset_not_found(self, tmp_openeye_home, monkeypatch):
        monkeypatch.setattr("openeye_ai.commands.mlops.evaluate.is_downloaded", lambda m: True)
        monkeypatch.setattr("openeye_ai.commands.mlops.evaluate.get_adapter", lambda m: MagicMock())
        result = runner.invoke(app, [
            "mlops", "evaluate", "yolov8", "--dataset", "/tmp/nonexistent.json",
        ])
        assert result.exit_code == 1
        assert "not found" in result.output

    def test_evaluate_success(self, tmp_path, tmp_openeye_home, monkeypatch):
        from openeye_ai.mlops.schemas import EvaluationMetrics

        mock_adapter = MagicMock()
        monkeypatch.setattr("openeye_ai.commands.mlops.evaluate.is_downloaded", lambda m: True)
        monkeypatch.setattr("openeye_ai.commands.mlops.evaluate.get_adapter", lambda m: mock_adapter)

        # Create a dummy dataset
        dataset = tmp_path / "val.json"
        dataset.write_text(json.dumps({
            "images": [], "annotations": [], "categories": [],
        }))

        mock_metrics = EvaluationMetrics(
            precision=0.85, recall=0.90, f1=0.87, mAP=0.82,
            total_images=100, total_predictions=500, total_ground_truth=450,
            per_class={"person": 0.90, "car": 0.75},
        )
        monkeypatch.setattr(
            "openeye_ai.mlops.evaluation.evaluate_model",
            lambda *a, **kw: mock_metrics,
        )

        result = runner.invoke(app, [
            "mlops", "evaluate", "yolov8", "--dataset", str(dataset),
        ])
        assert result.exit_code == 0
        assert "Precision" in result.output
        assert "Recall" in result.output
        assert "mAP" in result.output


# ── Story 75: create-ab-test ─────────────────────────────────────────


class TestCreateABTest:
    def test_create_ab_test(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "create-ab-test",
            "--champion", "yolov8-v2",
            "--challenger", "yolov8-v3",
            "--traffic", "80/20",
        ])
        assert result.exit_code == 0
        assert "A/B test created" in result.output
        assert "80%" in result.output
        assert "20%" in result.output

    def test_create_ab_test_default_traffic(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "create-ab-test",
            "--champion", "yolov8-v2",
            "--challenger", "yolov8-v3",
        ])
        assert result.exit_code == 0
        assert "50%" in result.output

    def test_create_ab_test_invalid_traffic(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "create-ab-test",
            "--champion", "yolov8-v2",
            "--challenger", "yolov8-v3",
            "--traffic", "invalid",
        ])
        assert result.exit_code == 1


# ── Story 76: ab-tests ──────────────────────────────────────────────


class TestABTests:
    def test_ab_tests_empty(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "ab-tests"])
        assert result.exit_code == 0
        assert "No A/B tests" in result.output

    def test_ab_tests_shows_running(self, tmp_openeye_home):
        # Create a test first
        runner.invoke(app, [
            "mlops", "create-ab-test",
            "--champion", "yolov8-v2",
            "--challenger", "yolov8-v3",
            "--traffic", "80/20",
        ])
        result = runner.invoke(app, ["mlops", "ab-tests"])
        assert result.exit_code == 0
        # Rich table may truncate "yolov8" to "yolo…" — check for prefix
        assert "yolo" in result.output
        assert "runn" in result.output


# ── Story 77: complete-ab-test ───────────────────────────────────────


class TestCompleteABTest:
    def test_complete_ab_test(self, tmp_openeye_home):
        # Create a test
        create_result = runner.invoke(app, [
            "mlops", "create-ab-test",
            "--champion", "yolov8-v2",
            "--challenger", "yolov8-v3",
        ])
        # Extract test ID from output
        for line in create_result.output.splitlines():
            if "ab-" in line:
                test_id = line.split("ab-")[1].split("[")[0].split("]")[0]
                test_id = "ab-" + test_id.strip()
                break

        result = runner.invoke(app, ["mlops", "complete-ab-test", test_id])
        assert result.exit_code == 0
        assert "completed" in result.output.lower()

    def test_complete_nonexistent(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "complete-ab-test", "ab-nonexistent"])
        assert result.exit_code == 1


# ── Story 78: pipeline-create ────────────────────────────────────────


class TestPipelineCreate:
    def test_pipeline_create_with_schedule(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "pipeline-create",
            "--name", "nightly-retrain",
            "--schedule", "0 2 * * *",
        ])
        assert result.exit_code == 0
        assert "Pipeline created" in result.output
        assert "nightly-retrain" in result.output

    def test_pipeline_create_minimal(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "pipeline-create",
            "--name", "manual-retrain",
        ])
        assert result.exit_code == 0
        assert "Pipeline created" in result.output


# ── Story 79: retrain ────────────────────────────────────────────────


class TestRetrain:
    def test_retrain_unknown_pipeline(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "retrain", "nonexistent"])
        assert result.exit_code == 1

    def test_retrain_triggers_run(self, tmp_openeye_home, monkeypatch):
        # Create pipeline first
        runner.invoke(app, [
            "mlops", "pipeline-create",
            "--name", "test-pipeline",
            "--script", "echo ok",
        ])
        result = runner.invoke(app, ["mlops", "retrain", "test-pipeline"])
        assert result.exit_code == 0
        assert "Retraining triggered" in result.output


# ── Story 80: runs ──────────────────────────────────────────────────


class TestRuns:
    def test_runs_empty(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "runs"])
        assert result.exit_code == 0
        assert "No retraining runs" in result.output

    def test_runs_after_retrain(self, tmp_openeye_home):
        runner.invoke(app, [
            "mlops", "pipeline-create",
            "--name", "test-pipe",
            "--script", "echo ok",
        ])
        runner.invoke(app, ["mlops", "retrain", "test-pipe"])
        result = runner.invoke(app, ["mlops", "runs"])
        assert result.exit_code == 0
        # Rich table may truncate "test-pipe" — check for prefix
        assert "test-pi" in result.output


# ── Story 81: batch-create ───────────────────────────────────────────


class TestBatchCreate:
    def test_batch_create(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "batch-create",
            "--model", "yolov8",
            "--input", "s3://bucket/images/",
        ])
        assert result.exit_code == 0
        assert "Batch job created" in result.output
        assert "s3://bucket/images/" in result.output

    def test_batch_create_local(self, tmp_openeye_home, tmp_path):
        result = runner.invoke(app, [
            "mlops", "batch-create",
            "--model", "yolov8",
            "--input", str(tmp_path),
        ])
        assert result.exit_code == 0
        assert "Batch job created" in result.output


# ── Story 82: export ─────────────────────────────────────────────────


class TestExport:
    def test_export_invalid_format(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "export", "yolov8", "--format", "invalid",
        ])
        assert result.exit_code == 1
        assert "Invalid format" in result.output

    def test_export_model_not_found(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "export", "nonexistent", "--format", "onnx",
        ])
        assert result.exit_code == 1


# ── Story 83: feedback ───────────────────────────────────────────────


class TestFeedback:
    def test_feedback_correct_prediction(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "feedback",
            "--prediction-id", "pred-123",
            "--correct", "true",
        ])
        assert result.exit_code == 0
        assert "confirmed correct" in result.output

    def test_feedback_incorrect_with_label(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "feedback",
            "--prediction-id", "pred-456",
            "--correct", "false",
            "--label", "forklift",
        ])
        assert result.exit_code == 0
        assert "Feedback recorded" in result.output
        assert "forklift" in result.output

    def test_feedback_incorrect_missing_label(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "feedback",
            "--prediction-id", "pred-789",
            "--correct", "false",
        ])
        assert result.exit_code == 1
        assert "--label is required" in result.output


# ── Story 84: shadow-mode ───────────────────────────────────────────


class TestShadowMode:
    def test_shadow_mode_create(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "shadow-mode",
            "--champion", "v2",
            "--challenger", "v3",
        ])
        assert result.exit_code == 0
        assert "Shadow deployment created" in result.output
        assert "v2" in result.output
        assert "v3" in result.output

    def test_shadow_mode_with_model(self, tmp_openeye_home):
        result = runner.invoke(app, [
            "mlops", "shadow-mode",
            "--champion", "v2",
            "--challenger", "v3",
            "--model", "yolov8",
        ])
        assert result.exit_code == 0
        assert "Shadow deployment created" in result.output

    def test_shadow_status_empty(self, tmp_openeye_home):
        result = runner.invoke(app, ["mlops", "shadow-status"])
        assert result.exit_code == 0
        assert "No shadow deployments" in result.output

    def test_shadow_status_shows_deployment(self, tmp_openeye_home):
        runner.invoke(app, [
            "mlops", "shadow-mode",
            "--champion", "v2",
            "--challenger", "v3",
            "--model", "yolov8",
        ])
        result = runner.invoke(app, ["mlops", "shadow-status"])
        assert result.exit_code == 0
        assert "yolov8" in result.output

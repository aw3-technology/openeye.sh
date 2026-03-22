"""Tests for MLOps internal modules (pure logic, persistence, validation).

Covers the 14 modules that have zero unit tests for their internal functions:
  model_registry, lifecycle, evaluation, retraining, batch_inference,
  shadow_mode, ab_testing, validation, lineage, export, feedback,
  benchmark_matrix, persistence, schemas.
"""

from __future__ import annotations

import json
import os
import textwrap
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import yaml

# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _isolate_mlops(tmp_openeye_home, monkeypatch):
    """Redirect all MLOps YAML paths to a temp dir so tests don't touch real state."""
    home = tmp_openeye_home
    monkeypatch.setattr("openeye_ai.mlops.model_registry._ENTERPRISE_REGISTRY_PATH", home / "registry.yaml")
    monkeypatch.setattr("openeye_ai.mlops.model_registry.MODELS_DIR", home / "models")
    monkeypatch.setattr("openeye_ai.mlops.lifecycle._PROMOTIONS_PATH", home / "promotions.yaml")
    monkeypatch.setattr("openeye_ai.mlops.ab_testing._AB_TESTS_PATH", home / "ab_tests.yaml")
    monkeypatch.setattr("openeye_ai.mlops.shadow_mode._SHADOW_PATH", home / "shadow_deployments.yaml")
    monkeypatch.setattr("openeye_ai.mlops.retraining._PIPELINES_PATH", home / "retraining_pipelines.yaml")
    monkeypatch.setattr("openeye_ai.mlops.retraining._RUNS_PATH", home / "retraining_runs.yaml")
    monkeypatch.setattr("openeye_ai.mlops.batch_inference._BATCH_JOBS_PATH", home / "batch_jobs.yaml")
    monkeypatch.setattr("openeye_ai.mlops.feedback._ANNOTATIONS_PATH", home / "annotations.yaml")
    monkeypatch.setattr("openeye_ai.mlops.feedback._BATCHES_PATH", home / "feedback_batches.yaml")
    monkeypatch.setattr("openeye_ai.mlops.validation._TESTS_PATH", home / "validation_tests.yaml")
    monkeypatch.setattr("openeye_ai.mlops.validation._RUNS_PATH", home / "validation_runs.yaml")
    monkeypatch.setattr("openeye_ai.mlops.lineage._LINEAGE_PATH", home / "model_lineage.yaml")
    monkeypatch.setattr("openeye_ai.mlops.export._EXPORTS_PATH", home / "model_exports.yaml")
    monkeypatch.setattr("openeye_ai.mlops.benchmark_matrix._BENCHMARKS_PATH", home / "benchmark_results.yaml")


@pytest.fixture()
def model_file(tmp_path):
    """Create a fake .pt model file."""
    p = tmp_path / "my-model.pt"
    p.write_bytes(b"\x00" * 2048)
    return p


@pytest.fixture()
def _seed_registry(tmp_openeye_home, model_file):
    """Upload a model into the enterprise registry for tests that need one."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    upload_and_register(
        ModelUploadRequest(
            name="Test Model",
            key="test-model",
            format=ModelFormat.PYTORCH,
            task="detection",
            file_path=str(model_file),
        )
    )


# =====================================================================
# persistence.py
# =====================================================================


class TestPersistence:
    def test_atomic_save_and_load_yaml(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml, safe_load_yaml

        path = tmp_path / "data.yaml"
        atomic_save_yaml(path, {"key": "value", "items": [1, 2, 3]})
        data = safe_load_yaml(path)
        assert data == {"key": "value", "items": [1, 2, 3]}

    def test_safe_load_yaml_missing_file_returns_default(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        result = safe_load_yaml(tmp_path / "nope.yaml", default=dict)
        assert result == {}

    def test_safe_load_yaml_corrupt_file(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        path = tmp_path / "bad.yaml"
        path.write_text("{{{{not: valid: yaml: ][][")
        result = safe_load_yaml(path, default=lambda: {"fallback": True})
        assert result == {"fallback": True}
        # Corrupt file should be backed up
        assert (tmp_path / "bad.yaml.corrupt").exists()

    def test_safe_load_yaml_empty_file_returns_default(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        path = tmp_path / "empty.yaml"
        path.write_text("")
        result = safe_load_yaml(path, default=lambda: [])
        assert result == []

    def test_safe_load_yaml_list(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml, safe_load_yaml_list

        path = tmp_path / "items.yaml"
        atomic_save_yaml(path, [{"a": 1}, {"b": 2}])
        result = safe_load_yaml_list(path)
        assert len(result) == 2
        assert result[0] == {"a": 1}

    def test_safe_load_yaml_list_non_list_returns_empty(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml_list

        path = tmp_path / "notlist.yaml"
        path.write_text("key: value\n")
        result = safe_load_yaml_list(path)
        assert result == []

    def test_atomic_save_creates_parent_dirs(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml

        path = tmp_path / "deep" / "nested" / "dir" / "data.yaml"
        atomic_save_yaml(path, {"ok": True})
        assert path.exists()


# =====================================================================
# schemas (base, versioning, governance, operations)
# =====================================================================


class TestSchemas:
    def test_training_metrics_defaults(self):
        from openeye_ai.mlops.schemas import TrainingMetrics

        m = TrainingMetrics()
        assert m.accuracy is None
        assert m.custom == {}

    def test_model_version_round_trip(self):
        from openeye_ai.mlops.schemas import ModelFormat, ModelVersion

        v = ModelVersion(
            version="1.0.0",
            model_key="my-model",
            format=ModelFormat.ONNX,
            file_path="/tmp/model.onnx",
            file_size_mb=12.5,
        )
        data = v.model_dump()
        assert data["version"] == "1.0.0"
        v2 = ModelVersion(**data)
        assert v2.version == v.version

    def test_model_registry_entry_latest_version(self):
        from openeye_ai.mlops.schemas import ModelFormat, ModelRegistryEntry, ModelVersion

        entry = ModelRegistryEntry(
            key="my-model",
            name="My Model",
            task="detection",
            adapter="yolo",
            versions=[
                ModelVersion(version="1.0.0", model_key="my-model", format=ModelFormat.ONNX, file_path="/a"),
                ModelVersion(version="2.0.0", model_key="my-model", format=ModelFormat.ONNX, file_path="/b"),
            ],
        )
        assert entry.latest_version.version == "2.0.0"
        assert entry.production_version is None

    def test_model_upload_request_key_validation(self):
        from pydantic import ValidationError
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        with pytest.raises(ValidationError):
            ModelUploadRequest(
                name="Bad", key="!!!invalid!!!", format=ModelFormat.ONNX,
                task="detection", file_path="/tmp/m.onnx",
            )

    def test_ab_test_config_versions_must_differ(self):
        from pydantic import ValidationError
        from openeye_ai.mlops.schemas import ABTestConfig

        with pytest.raises(ValidationError, match="must be different"):
            ABTestConfig(
                name="test", model_key="m", version_a="v1", version_b="v1",
            )

    def test_shadow_deployment_config_versions_must_differ(self):
        from pydantic import ValidationError
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig

        with pytest.raises(ValidationError, match="must be different"):
            ShadowDeploymentConfig(
                name="shadow", model_key="m",
                production_version="v1", shadow_version="v1",
            )

    def test_evaluation_metrics_defaults(self):
        from openeye_ai.mlops.schemas import EvaluationMetrics

        m = EvaluationMetrics()
        assert m.precision == 0.0
        assert m.per_class == {}

    def test_enum_yaml_serialization(self):
        """Enums should serialize to their string value via the custom representer."""
        from openeye_ai.mlops.schemas import ModelStage

        result = yaml.safe_dump({"stage": ModelStage.PRODUCTION})
        assert "production" in result


# =====================================================================
# model_registry.py
# =====================================================================


class TestModelRegistry:
    def test_compute_checksum(self, tmp_path):
        from openeye_ai.mlops.model_registry import _compute_checksum

        f = tmp_path / "data.bin"
        f.write_bytes(b"hello world")
        h = _compute_checksum(f)
        assert len(h) == 64  # SHA-256 hex digest

    def test_upload_and_list(self, model_file):
        from openeye_ai.mlops.model_registry import list_registered_models, upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        upload_and_register(
            ModelUploadRequest(
                name="UploadTest", key="upload-test", format=ModelFormat.PYTORCH,
                task="detection", file_path=str(model_file),
            )
        )
        models = list_registered_models()
        assert any(m.key == "upload-test" for m in models)

    def test_upload_wrong_extension(self, tmp_path):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        f = tmp_path / "model.txt"
        f.write_bytes(b"\x00")
        with pytest.raises(ValueError, match="extension"):
            upload_and_register(
                ModelUploadRequest(
                    name="Bad", key="bad-ext", format=ModelFormat.ONNX,
                    task="detection", file_path=str(f),
                )
            )

    def test_upload_missing_file(self):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        with pytest.raises(FileNotFoundError):
            upload_and_register(
                ModelUploadRequest(
                    name="Missing", key="missing", format=ModelFormat.PYTORCH,
                    task="detection", file_path="/nonexistent/model.pt",
                )
            )

    def test_upload_duplicate_key(self, _seed_registry, model_file):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        with pytest.raises(ValueError, match="already exists"):
            upload_and_register(
                ModelUploadRequest(
                    name="Dup", key="test-model", format=ModelFormat.PYTORCH,
                    task="detection", file_path=str(model_file),
                )
            )

    def test_get_registered_model(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_registered_model

        entry = get_registered_model("test-model")
        assert entry.name == "Test Model"

    def test_get_registered_model_not_found(self):
        from openeye_ai.mlops.model_registry import get_registered_model

        with pytest.raises(KeyError, match="not in enterprise registry"):
            get_registered_model("nonexistent")

    def test_add_version_and_list(self, _seed_registry, tmp_path):
        from openeye_ai.mlops.model_registry import add_version, list_versions
        from openeye_ai.mlops.schemas import ModelFormat

        f2 = tmp_path / "v2.pt"
        f2.write_bytes(b"\x00" * 512)
        add_version(
            "test-model", file_path=str(f2), version="2.0.0",
            format=ModelFormat.PYTORCH, author="tester",
        )
        versions = list_versions("test-model")
        assert len(versions) == 2
        assert versions[-1].version == "2.0.0"

    def test_add_version_duplicate(self, _seed_registry, tmp_path):
        from openeye_ai.mlops.model_registry import add_version
        from openeye_ai.mlops.schemas import ModelFormat

        f2 = tmp_path / "dup.pt"
        f2.write_bytes(b"\x00" * 512)
        with pytest.raises(ValueError, match="already exists"):
            add_version(
                "test-model", file_path=str(f2), version="1.0.0",
                format=ModelFormat.PYTORCH,
            )

    def test_get_version(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_version

        v = get_version("test-model", "1.0.0")
        assert v.version == "1.0.0"

    def test_get_version_not_found(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_version

        with pytest.raises(KeyError, match="not found"):
            get_version("test-model", "9.9.9")

    def test_load_registry_corrupt_entry_skipped(self, tmp_openeye_home):
        """Corrupt entries are skipped, not crash the listing."""
        from openeye_ai.mlops.model_registry import list_registered_models
        from openeye_ai.mlops.persistence import atomic_save_yaml

        registry_path = tmp_openeye_home / "registry.yaml"
        atomic_save_yaml(registry_path, {
            "schema_version": 3,
            "models": {
                "good": {
                    "name": "Good", "task": "detection", "adapter": "yolo",
                    "versions": [],
                },
                "corrupt": "not a dict",
            },
        })
        models = list_registered_models()
        assert len(models) == 1
        assert models[0].key == "good"


# =====================================================================
# lifecycle.py — gate evaluation & valid transitions
# =====================================================================


class TestLifecycle:
    def test_valid_transitions(self):
        from openeye_ai.mlops.lifecycle import _VALID_TRANSITIONS
        from openeye_ai.mlops.schemas import ModelStage

        assert ModelStage.STAGING in _VALID_TRANSITIONS[ModelStage.DEV]
        assert ModelStage.PRODUCTION in _VALID_TRANSITIONS[ModelStage.STAGING]
        assert ModelStage.ARCHIVED in _VALID_TRANSITIONS[ModelStage.PRODUCTION]

    def test_find_gate(self):
        from openeye_ai.mlops.lifecycle import _find_gate
        from openeye_ai.mlops.schemas import ModelStage

        gate = _find_gate(ModelStage.DEV, ModelStage.STAGING)
        assert gate is not None
        assert gate.auto_approve_if == "accuracy > 0.90"

        gate2 = _find_gate(ModelStage.STAGING, ModelStage.PRODUCTION)
        assert gate2 is not None
        assert "ml-lead" in gate2.required_approvers

        assert _find_gate(ModelStage.DEV, ModelStage.PRODUCTION) is None

    def test_evaluate_gate_condition_simple(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95)

        assert _evaluate_gate_condition("accuracy > 0.90", version) is True
        assert _evaluate_gate_condition("accuracy > 0.99", version) is False

    def test_evaluate_gate_condition_compound(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95, loss=0.3)

        assert _evaluate_gate_condition("accuracy > 0.90 and loss < 0.5", version) is True
        assert _evaluate_gate_condition("accuracy > 0.90 and loss < 0.1", version) is False

    def test_evaluate_gate_condition_missing_metric(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics()

        assert _evaluate_gate_condition("nonexistent > 0.5", version) is False

    def test_evaluate_gate_condition_no_metrics(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition

        version = MagicMock()
        version.training_metrics = None

        assert _evaluate_gate_condition("accuracy > 0.5", version) is False

    def test_evaluate_gate_condition_operators(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95, f1=0.80)

        assert _evaluate_gate_condition("accuracy >= 0.95", version) is True
        assert _evaluate_gate_condition("accuracy == 0.95", version) is True
        assert _evaluate_gate_condition("accuracy != 0.90", version) is True
        assert _evaluate_gate_condition("accuracy < 0.95", version) is False
        assert _evaluate_gate_condition("accuracy <= 0.95", version) is True

    def test_evaluate_gate_condition_bad_expression(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95)

        assert _evaluate_gate_condition("not a valid condition", version) is False

    def test_evaluate_gate_condition_custom_metrics(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(custom={"auc": 0.98})

        assert _evaluate_gate_condition("auc > 0.95", version) is True

    def test_request_promotion_invalid_transition(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        with pytest.raises(ValueError, match="Cannot promote"):
            request_promotion(
                PromotionRequest(
                    model_key="test-model", version="1.0.0",
                    target_stage=ModelStage.PRODUCTION, requester="tester",
                )
            )

    def test_request_promotion_valid(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        record = request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        assert record.from_stage == ModelStage.DEV
        assert record.to_stage == ModelStage.STAGING

    def test_list_promotions(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import list_promotions, request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        records = list_promotions()
        assert len(records) >= 1
        filtered = list_promotions(model_key="test-model")
        assert len(filtered) >= 1
        assert list_promotions(model_key="nonexistent") == []


# =====================================================================
# evaluation.py — IoU, AP, annotation loading
# =====================================================================


class TestEvaluation:
    def test_compute_iou_perfect_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        box = {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}
        assert _compute_iou(box, box) == pytest.approx(1.0)

    def test_compute_iou_no_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.1, "h": 0.1}
        b = {"x": 0.5, "y": 0.5, "w": 0.1, "h": 0.1}
        assert _compute_iou(a, b) == 0.0

    def test_compute_iou_partial_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.2, "h": 0.2}
        b = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
        iou = _compute_iou(a, b)
        assert 0.0 < iou < 1.0
        # Intersection: 0.1*0.1 = 0.01, Union: 0.04+0.04-0.01 = 0.07
        assert iou == pytest.approx(0.01 / 0.07, rel=1e-6)

    def test_compute_iou_zero_area(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
        b = {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
        assert _compute_iou(a, b) == 0.0

    def test_compute_ap_empty(self):
        from openeye_ai.mlops.evaluation import _compute_ap

        assert _compute_ap([], []) == 0.0

    def test_compute_ap_perfect(self):
        from openeye_ai.mlops.evaluation import _compute_ap

        precisions = [1.0, 1.0, 1.0]
        recalls = [0.33, 0.67, 1.0]
        ap = _compute_ap(precisions, recalls)
        assert ap == pytest.approx(1.0)

    def test_load_coco_annotations(self, tmp_path):
        from openeye_ai.mlops.evaluation import _load_coco_annotations

        coco = {
            "images": [{"id": 1, "file_name": "img1.jpg"}],
            "categories": [{"id": 1, "name": "person"}],
            "annotations": [
                {"image_id": 1, "category_id": 1, "bbox": [10, 20, 30, 40]},
            ],
        }
        p = tmp_path / "annotations.json"
        p.write_text(json.dumps(coco))
        result = _load_coco_annotations(p)
        assert "img1.jpg" in result
        assert result["img1.jpg"][0]["label"] == "person"
        assert result["img1.jpg"][0]["bbox"] == {"x": 10, "y": 20, "w": 30, "h": 40}

    def test_load_jsonl_annotations(self, tmp_path):
        from openeye_ai.mlops.evaluation import _load_jsonl_annotations

        lines = [
            json.dumps({"image": "a.jpg", "labels": [{"label": "car", "bbox": {"x": 0, "y": 0, "w": 1, "h": 1}}]}),
            json.dumps({"image": "b.jpg", "labels": []}),
        ]
        p = tmp_path / "annotations.jsonl"
        p.write_text("\n".join(lines))
        result = _load_jsonl_annotations(p)
        assert "a.jpg" in result
        assert result["a.jpg"][0]["label"] == "car"
        assert "b.jpg" in result


# =====================================================================
# validation.py — condition evaluation
# =====================================================================


class TestValidation:
    def test_evaluate_condition_pass(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("accuracy > 0.90", {"accuracy": 0.95})
        assert result.passed is True
        assert result.actual_value == 0.95

    def test_evaluate_condition_fail(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("accuracy > 0.90", {"accuracy": 0.80})
        assert result.passed is False

    def test_evaluate_condition_missing_metric(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("latency_ms < 50", {})
        # Missing metric defaults to 0.0
        assert result.actual_value == 0.0
        assert result.passed is True  # 0.0 < 50

    def test_evaluate_condition_all_operators(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        metrics = {"x": 5.0}
        assert _evaluate_condition("x > 4", metrics).passed is True
        assert _evaluate_condition("x >= 5", metrics).passed is True
        assert _evaluate_condition("x < 6", metrics).passed is True
        assert _evaluate_condition("x <= 5", metrics).passed is True
        assert _evaluate_condition("x == 5", metrics).passed is True
        assert _evaluate_condition("x != 3", metrics).passed is True

    def test_evaluate_condition_bad_format(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("not valid", {"x": 1.0})
        assert result.passed is False

    def test_create_validation_test_bad_condition(self):
        from openeye_ai.mlops.validation import create_validation_test

        with pytest.raises(ValueError, match="Invalid condition"):
            create_validation_test(
                name="bad", model_key="m", test_dataset="/tmp/d",
                conditions=["not a real condition"],
            )

    def test_create_and_list_validation_tests(self):
        from openeye_ai.mlops.validation import create_validation_test, list_validation_tests

        create_validation_test(
            name="smoke", model_key="mymodel", test_dataset="/data",
            conditions=["accuracy > 0.8", "latency_ms < 100"],
        )
        tests = list_validation_tests()
        assert len(tests) == 1
        assert tests[0].name == "smoke"

        filtered = list_validation_tests(model_key="mymodel")
        assert len(filtered) == 1
        assert list_validation_tests(model_key="other") == []


# =====================================================================
# ab_testing.py — winner determination
# =====================================================================


class TestABTesting:
    def test_determine_winner_accuracy(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test1",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1", mean_accuracy=0.90),
            metrics_b=ABTestMetrics(version="v2", mean_accuracy=0.95),
        )
        _determine_winner(test)
        assert test.winner == "v2"

    def test_determine_winner_latency_tiebreak(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test2",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1", mean_accuracy=0.90, mean_latency_ms=10),
            metrics_b=ABTestMetrics(version="v2", mean_accuracy=0.90, mean_latency_ms=20),
        )
        _determine_winner(test)
        assert test.winner == "v1"  # lower latency wins

    def test_determine_winner_equal_defaults_to_a(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test3",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1"),
            metrics_b=ABTestMetrics(version="v2"),
        )
        _determine_winner(test)
        assert test.winner == "v1"

    def test_create_and_list_ab_tests(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, list_ab_tests
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp1", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        assert test.id.startswith("ab-")

        tests = list_ab_tests()
        assert len(tests) == 1
        assert list_ab_tests(model_key="m") == tests
        assert list_ab_tests(model_key="other") == []

    def test_record_result_updates_metrics(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp2", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)

        updated = record_result(test.id, "v1", latency_ms=10.0, accuracy=0.9)
        assert updated.metrics_a.samples == 1
        assert updated.metrics_a.mean_latency_ms == 10.0
        assert updated.metrics_a.mean_accuracy == 0.9

    def test_record_result_unknown_version(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp3", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)

        with pytest.raises(ValueError, match="not part of test"):
            record_result(test.id, "v99", latency_ms=10.0)


# =====================================================================
# batch_inference.py — local helpers, format results
# =====================================================================


class TestBatchInference:
    def test_list_local_images(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _list_local_images

        (tmp_path / "a.jpg").write_bytes(b"\xff")
        (tmp_path / "b.png").write_bytes(b"\xff")
        (tmp_path / "c.txt").write_text("nope")
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "d.jpeg").write_bytes(b"\xff")

        images = _list_local_images(str(tmp_path))
        names = [p.name for p in images]
        assert "a.jpg" in names
        assert "b.png" in names
        assert "d.jpeg" in names
        assert "c.txt" not in names

    def test_list_local_images_missing_dir(self):
        from openeye_ai.mlops.batch_inference import _list_local_images

        with pytest.raises(FileNotFoundError):
            _list_local_images("/nonexistent/dir")

    def test_format_results_jsonl(self):
        from openeye_ai.mlops.batch_inference import _format_results

        results = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
        out = _format_results(results, "jsonl")
        lines = out.strip().split("\n")
        assert len(lines) == 2
        assert json.loads(lines[0]) == {"a": 1, "b": 2}

    def test_format_results_csv(self):
        from openeye_ai.mlops.batch_inference import _format_results

        results = [{"name": "x", "val": 1}, {"name": "y", "val": 2}]
        out = _format_results(results, "csv")
        assert "name" in out
        assert "x" in out

    def test_format_results_csv_empty(self):
        from openeye_ai.mlops.batch_inference import _format_results

        assert _format_results([], "csv") == ""

    def test_format_results_unsupported(self):
        from openeye_ai.mlops.batch_inference import _format_results

        with pytest.raises(ValueError, match="Unsupported"):
            _format_results([], "parquet")

    def test_write_results_local_jsonl(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _write_results_local

        results = [{"source": "a.jpg", "label": "cat"}]
        dest = _write_results_local(results, str(tmp_path / "out.jsonl"), "jsonl")
        content = Path(dest).read_text()
        assert "cat" in content

    def test_write_results_local_csv(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _write_results_local

        results = [{"source": "a.jpg", "label": "dog"}]
        dest = _write_results_local(results, str(tmp_path / "out.csv"), "csv")
        content = Path(dest).read_text()
        assert "source" in content
        assert "dog" in content

    def test_create_and_get_batch_job(self):
        from openeye_ai.mlops.batch_inference import create_batch_job, get_batch_job
        from openeye_ai.mlops.schemas import BatchInferenceConfig

        config = BatchInferenceConfig(
            name="job1", model_key="m", model_version="1.0",
            input_path="/data/images", output_path="/data/results",
        )
        job = create_batch_job(config)
        assert job.id.startswith("batch-")

        fetched = get_batch_job(job.id)
        assert fetched.config.name == "job1"

    def test_get_batch_job_not_found(self):
        from openeye_ai.mlops.batch_inference import get_batch_job

        with pytest.raises(KeyError):
            get_batch_job("batch-nonexistent")


# =====================================================================
# shadow_mode.py
# =====================================================================


class TestShadowMode:
    def test_create_and_list(self):
        from openeye_ai.mlops.shadow_mode import create_shadow_deployment, list_shadow_deployments
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig

        config = ShadowDeploymentConfig(
            name="s1", model_key="m",
            production_version="v1", shadow_version="v2",
        )
        dep = create_shadow_deployment(config)
        assert dep.id.startswith("shadow-")
        assert dep.status.value == "active"

        deps = list_shadow_deployments()
        assert len(deps) == 1
        assert list_shadow_deployments(model_key="m") == deps
        assert list_shadow_deployments(model_key="other") == []

    def test_complete_shadow_deployment(self):
        from openeye_ai.mlops.shadow_mode import (
            complete_shadow_deployment,
            create_shadow_deployment,
        )
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig, ShadowStatus

        config = ShadowDeploymentConfig(
            name="s2", model_key="m",
            production_version="v1", shadow_version="v2",
        )
        dep = create_shadow_deployment(config)
        completed = complete_shadow_deployment(dep.id)
        assert completed.status == ShadowStatus.COMPLETED
        assert completed.completed_at is not None

    def test_complete_nonexistent(self):
        from openeye_ai.mlops.shadow_mode import complete_shadow_deployment

        with pytest.raises(KeyError):
            complete_shadow_deployment("shadow-nope")


# =====================================================================
# retraining.py — drift detection logic
# =====================================================================


class TestRetraining:
    def test_create_and_get_pipeline(self):
        from openeye_ai.mlops.retraining import create_pipeline, get_pipeline
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        config = RetrainingPipelineConfig(
            name="pipe1", model_key="m", training_script="echo ok",
        )
        create_pipeline(config)
        fetched = get_pipeline("pipe1")
        assert fetched.name == "pipe1"

    def test_create_duplicate_pipeline(self):
        from openeye_ai.mlops.retraining import create_pipeline
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        config = RetrainingPipelineConfig(
            name="dup-pipe", model_key="m", training_script="echo ok",
        )
        create_pipeline(config)
        with pytest.raises(ValueError, match="already exists"):
            create_pipeline(config)

    def test_get_pipeline_not_found(self):
        from openeye_ai.mlops.retraining import get_pipeline

        with pytest.raises(KeyError):
            get_pipeline("nonexistent")

    def test_list_pipelines(self):
        from openeye_ai.mlops.retraining import create_pipeline, list_pipelines
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        create_pipeline(RetrainingPipelineConfig(name="p1", model_key="m1", training_script="x"))
        create_pipeline(RetrainingPipelineConfig(name="p2", model_key="m2", training_script="y"))
        assert len(list_pipelines()) == 2
        assert len(list_pipelines(model_key="m1")) == 1

    def test_trigger_retraining(self):
        from openeye_ai.mlops.retraining import create_pipeline, trigger_retraining
        from openeye_ai.mlops.schemas import PipelineStatus, RetrainingPipelineConfig

        create_pipeline(RetrainingPipelineConfig(name="trig", model_key="m", training_script="echo ok"))
        run = trigger_retraining("trig", triggered_by="test")
        assert run.id.startswith("retrain-")
        assert run.status == PipelineStatus.RUNNING

    def test_trigger_retraining_duplicate_running(self):
        from openeye_ai.mlops.retraining import create_pipeline, trigger_retraining
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        create_pipeline(RetrainingPipelineConfig(name="dup-run", model_key="m", training_script="x"))
        trigger_retraining("dup-run")
        with pytest.raises(ValueError, match="already has a running"):
            trigger_retraining("dup-run")

    def test_record_accuracy_no_drift(self, monkeypatch):
        from openeye_ai.mlops import retraining
        from openeye_ai.mlops.retraining import record_accuracy

        # Clear buffer
        retraining._accuracy_buffer.clear()

        # No pipelines configured, so no drift detected
        assert record_accuracy("model-x", 0.95) is False

    def test_record_accuracy_drift_detected(self, monkeypatch):
        from openeye_ai.mlops import retraining
        from openeye_ai.mlops.retraining import create_pipeline, record_accuracy
        from openeye_ai.mlops.schemas import (
            DriftDetectionConfig,
            RetrainingPipelineConfig,
            RetrainingTrigger,
        )

        retraining._accuracy_buffer.clear()

        create_pipeline(RetrainingPipelineConfig(
            name="drift-pipe", model_key="driftmodel",
            trigger=RetrainingTrigger.ACCURACY_DRIFT,
            training_script="echo retrain",
            drift_config=DriftDetectionConfig(window_size=5, threshold=0.1),
        ))

        # Feed baseline (high accuracy)
        for _ in range(5):
            record_accuracy("driftmodel", 0.95)

        # Feed drifted values (low accuracy) — should trigger
        for _ in range(4):
            record_accuracy("driftmodel", 0.80)

        result = record_accuracy("driftmodel", 0.80)
        assert result is True


# =====================================================================
# lineage.py
# =====================================================================


class TestLineage:
    def test_record_and_get_lineage(self):
        from openeye_ai.mlops.lineage import get_lineage, record_lineage

        lineage = record_lineage(
            "model-a", "1.0.0",
            dataset="imagenet",
            code_commit="abc123",
            auto_detect_git=False,
        )
        assert lineage.dataset == "imagenet"
        assert lineage.code_commit == "abc123"

        fetched = get_lineage("model-a", "1.0.0")
        assert fetched.dataset == "imagenet"

    def test_get_lineage_not_found(self):
        from openeye_ai.mlops.lineage import get_lineage

        with pytest.raises(KeyError):
            get_lineage("nope", "1.0.0")

    def test_record_lineage_replaces_existing(self):
        from openeye_ai.mlops.lineage import get_lineage, list_lineage, record_lineage

        record_lineage("m", "1.0", dataset="d1", code_commit="c1", auto_detect_git=False)
        record_lineage("m", "1.0", dataset="d2", code_commit="c2", auto_detect_git=False)
        assert len(list_lineage(model_key="m")) == 1
        assert get_lineage("m", "1.0").dataset == "d2"

    def test_list_lineage(self):
        from openeye_ai.mlops.lineage import list_lineage, record_lineage

        record_lineage("m1", "1.0", dataset="d", code_commit="c", auto_detect_git=False)
        record_lineage("m2", "1.0", dataset="d", code_commit="c", auto_detect_git=False)
        assert len(list_lineage()) == 2
        assert len(list_lineage(model_key="m1")) == 1

    def test_lineage_chain(self):
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        record_lineage("m", "1.0", dataset="d1", code_commit="c1", auto_detect_git=False)
        record_lineage("m", "2.0", dataset="d2", code_commit="c2", auto_detect_git=False, parent_model="1.0")
        record_lineage("m", "3.0", dataset="d3", code_commit="c3", auto_detect_git=False, parent_model="2.0")

        chain = get_lineage_chain("m", "3.0")
        assert len(chain) == 3
        assert chain[0].version == "3.0"
        assert chain[1].version == "2.0"
        assert chain[2].version == "1.0"

    def test_lineage_chain_cycle_protection(self):
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        # Create a cycle: 1.0 -> 2.0 -> 1.0
        record_lineage("cyc", "1.0", dataset="d", code_commit="c", auto_detect_git=False, parent_model="2.0")
        record_lineage("cyc", "2.0", dataset="d", code_commit="c", auto_detect_git=False, parent_model="1.0")

        chain = get_lineage_chain("cyc", "1.0")
        # Should terminate without infinite loop
        assert len(chain) == 2

    @patch("openeye_ai.mlops.lineage.subprocess.check_output")
    def test_get_current_git_info(self, mock_check_output):
        from openeye_ai.mlops.lineage import _get_current_git_info

        def _fake_git(args, **kw):
            if "rev-parse" in args and "--abbrev-ref" in args:
                return "main\n"
            if "rev-parse" in args:
                return "abc123def\n"
            if "get-url" in args:
                return "https://github.com/example/repo.git\n"
            return ""

        mock_check_output.side_effect = _fake_git

        info = _get_current_git_info()
        assert info["commit"] == "abc123def"
        assert info["branch"] == "main"
        assert info["repo"] == "https://github.com/example/repo.git"


# =====================================================================
# export.py — format detection
# =====================================================================


class TestExport:
    def test_detect_source_format(self):
        from openeye_ai.mlops.export import _detect_source_format
        from openeye_ai.mlops.schemas import ModelFormat

        assert _detect_source_format(Path("model.onnx")) == ModelFormat.ONNX
        assert _detect_source_format(Path("model.pt")) == ModelFormat.PYTORCH
        assert _detect_source_format(Path("model.safetensors")) == ModelFormat.SAFETENSORS
        assert _detect_source_format(Path("model.engine")) == ModelFormat.TENSORRT
        assert _detect_source_format(Path("model.mlmodel")) == ModelFormat.COREML

    def test_detect_source_format_unknown(self):
        from openeye_ai.mlops.export import _detect_source_format

        with pytest.raises(ValueError, match="Unrecognized"):
            _detect_source_format(Path("model.xyz"))

    def test_list_exports_empty(self):
        from openeye_ai.mlops.export import list_exports

        assert list_exports() == []


# =====================================================================
# feedback.py
# =====================================================================


class TestFeedback:
    def test_annotate_and_list(self):
        from openeye_ai.mlops.feedback import annotate_failure, list_annotations
        from openeye_ai.mlops.schemas import AnnotationLabel

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="forklift",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
            predicted_label="person",
        )
        assert ann.id.startswith("ann-")

        annotations = list_annotations()
        assert len(annotations) == 1
        assert list_annotations(model_key="m") == annotations
        assert list_annotations(model_key="other") == []

    def test_list_annotations_unfed_only(self):
        from openeye_ai.mlops.feedback import annotate_failure, list_annotations
        from openeye_ai.mlops.schemas import AnnotationLabel

        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="x",
            annotation_label=AnnotationLabel.FALSE_POSITIVE,
        )
        assert len(list_annotations(unfed_only=True)) == 1
        assert len(list_annotations(unfed_only=False)) == 1

    def test_create_feedback_batch_no_annotations(self):
        from openeye_ai.mlops.feedback import create_feedback_batch

        with pytest.raises(ValueError, match="No annotations"):
            create_feedback_batch("m", "/output.jsonl")

    def test_execute_feedback_batch(self, tmp_path):
        from openeye_ai.mlops.feedback import (
            annotate_failure,
            create_feedback_batch,
            execute_feedback_batch,
            list_annotations,
        )
        from openeye_ai.mlops.schemas import AnnotationLabel, PipelineStatus

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="truck",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
            notes="Was labelled as car",
        )

        output = tmp_path / "corrections.jsonl"
        batch = create_feedback_batch("m", str(output), annotation_ids=[ann.id])
        result = execute_feedback_batch(batch.id)

        assert result.status == PipelineStatus.COMPLETED
        assert output.exists()
        content = output.read_text().strip()
        parsed = json.loads(content)
        assert parsed["label"] == "truck"
        assert parsed["notes"] == "Was labelled as car"

        # Annotation should be marked as fed back
        unfed = list_annotations(unfed_only=True)
        assert len(unfed) == 0

    def test_get_feedback_batch_not_found(self):
        from openeye_ai.mlops.feedback import get_feedback_batch

        with pytest.raises(KeyError):
            get_feedback_batch("fb-nope")


# =====================================================================
# benchmark_matrix.py — hardware detection
# =====================================================================


class TestBenchmarkMatrix:
    def test_detect_available_hardware_includes_cpu(self):
        """CPU should always be in the detected hardware list."""
        from openeye_ai.mlops.benchmark_matrix import _detect_available_hardware
        from openeye_ai.mlops.schemas import HardwareTarget

        result = _detect_available_hardware()
        assert HardwareTarget.CPU in result

    def test_get_benchmark_results_empty(self):
        from openeye_ai.mlops.benchmark_matrix import get_benchmark_results

        assert get_benchmark_results("nonexistent") == []

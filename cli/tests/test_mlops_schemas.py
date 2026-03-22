"""Tests for openeye_ai.mlops.schemas — Pydantic models and enums."""

from __future__ import annotations

import pytest
import yaml


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

    def test_model_registry_entry_no_versions(self):
        """Entry with no versions should have no latest or production version."""
        from openeye_ai.mlops.schemas import ModelRegistryEntry

        entry = ModelRegistryEntry(
            key="empty", name="Empty", task="detection", adapter="yolo",
            versions=[],
        )
        assert entry.latest_version is None
        assert entry.production_version is None

    def test_batch_inference_config_defaults(self):
        from openeye_ai.mlops.schemas import BatchInferenceConfig, StorageBackend

        config = BatchInferenceConfig(
            name="j", model_key="m", model_version="1.0",
            input_path="/data", output_path="/out",
        )
        assert config.storage_backend == StorageBackend.LOCAL
        assert config.output_format == "jsonl"
        assert config.max_workers >= 1

    def test_retraining_pipeline_config_defaults(self):
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig, RetrainingTrigger

        config = RetrainingPipelineConfig(
            name="p", model_key="m", training_script="train.py",
        )
        assert config.trigger == RetrainingTrigger.ACCURACY_DRIFT
        assert config.drift_config is None
        assert config.training_args == {}

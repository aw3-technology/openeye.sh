"""Tests for openeye_ai.mlops.retraining — drift detection logic."""

from __future__ import annotations

import pytest


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

    def test_get_run_not_found(self):
        from openeye_ai.mlops.retraining import get_run

        with pytest.raises(KeyError, match="not found"):
            get_run("retrain-nonexistent")

    def test_get_run_success(self):
        from openeye_ai.mlops.retraining import create_pipeline, get_run, trigger_retraining
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        create_pipeline(RetrainingPipelineConfig(name="get-run", model_key="m", training_script="x"))
        run = trigger_retraining("get-run")
        fetched = get_run(run.id)
        assert fetched.id == run.id
        assert fetched.pipeline_name == "get-run"

    def test_list_runs(self):
        from openeye_ai.mlops.retraining import create_pipeline, list_runs, trigger_retraining
        from openeye_ai.mlops.schemas import RetrainingPipelineConfig

        create_pipeline(RetrainingPipelineConfig(name="lr1", model_key="m1", training_script="x"))
        create_pipeline(RetrainingPipelineConfig(name="lr2", model_key="m2", training_script="y"))
        trigger_retraining("lr1")
        trigger_retraining("lr2")
        assert len(list_runs()) == 2
        assert len(list_runs(pipeline_name="lr1")) == 1
        assert len(list_runs(model_key="m2")) == 1
        assert len(list_runs(model_key="nonexistent")) == 0

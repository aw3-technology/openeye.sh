"""Automated retraining pipelines with drift detection (story 185)."""

from __future__ import annotations

import subprocess
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list

from .schemas import (
    DriftDetectionConfig,
    PipelineStatus,
    RetrainingPipelineConfig,
    RetrainingRun,
    RetrainingTrigger,
    TrainingMetrics,
)

_PIPELINES_PATH = OPENEYE_HOME / "retraining_pipelines.yaml"
_RUNS_PATH = OPENEYE_HOME / "retraining_runs.yaml"

# In-memory accuracy buffer for drift detection
_accuracy_buffer: dict[str, deque] = {}

def _load_pipelines() -> list[dict]:
    return safe_load_yaml_list(_PIPELINES_PATH)

def _save_pipelines(pipelines: list[dict]) -> None:
    atomic_save_yaml(_PIPELINES_PATH, pipelines)

def _load_runs() -> list[dict]:
    return safe_load_yaml_list(_RUNS_PATH)

def _save_runs(runs: list[dict]) -> None:
    atomic_save_yaml(_RUNS_PATH, runs)

def create_pipeline(config: RetrainingPipelineConfig) -> RetrainingPipelineConfig:
    """Register a new retraining pipeline."""
    pipelines = _load_pipelines()
    for p in pipelines:
        if p["name"] == config.name:
            raise ValueError(f"Pipeline '{config.name}' already exists.")
    pipelines.append(config.model_dump())
    _save_pipelines(pipelines)
    return config

def get_pipeline(name: str) -> RetrainingPipelineConfig:
    """Get a pipeline by name."""
    pipelines = _load_pipelines()
    for p in pipelines:
        if p["name"] == name:
            return RetrainingPipelineConfig(**p)
    raise KeyError(f"Pipeline '{name}' not found.")

def list_pipelines(model_key: str | None = None) -> list[RetrainingPipelineConfig]:
    """List all retraining pipelines."""
    pipelines = _load_pipelines()
    result = [RetrainingPipelineConfig(**p) for p in pipelines]
    if model_key:
        result = [p for p in result if p.model_key == model_key]
    return result

def record_accuracy(model_key: str, accuracy: float) -> bool:
    """Record an accuracy measurement and check for drift.

    Returns True if drift was detected (triggering retraining).
    """
    if model_key not in _accuracy_buffer:
        _accuracy_buffer[model_key] = deque(maxlen=10000)

    _accuracy_buffer[model_key].append(accuracy)

    # Check pipelines with drift detection
    pipelines = list_pipelines(model_key)
    for pipeline in pipelines:
        if pipeline.trigger != RetrainingTrigger.ACCURACY_DRIFT:
            continue
        if pipeline.drift_config is None:
            continue

        cfg = pipeline.drift_config
        buf = _accuracy_buffer[model_key]
        if len(buf) < cfg.window_size:
            continue

        # Need at least 2x window to have distinct baseline vs recent
        if len(buf) < cfg.window_size * 2:
            continue
        recent = list(buf)[-cfg.window_size :]
        baseline = list(buf)[: cfg.window_size]

        recent_mean = sum(recent) / len(recent)
        baseline_mean = sum(baseline) / len(baseline)

        drift = baseline_mean - recent_mean
        if drift > cfg.threshold:
            trigger_retraining(pipeline.name, triggered_by="drift_detector")
            return True

    return False

def trigger_retraining(
    pipeline_name: str,
    triggered_by: str = "manual",
) -> RetrainingRun:
    """Trigger a retraining run for a pipeline."""
    pipeline = get_pipeline(pipeline_name)

    # Prevent duplicate concurrent runs
    existing_runs = list_runs(pipeline_name=pipeline_name)
    for r in existing_runs:
        if r.status == PipelineStatus.RUNNING:
            raise ValueError(
                f"Pipeline '{pipeline_name}' already has a running retraining job: {r.id}"
            )

    run = RetrainingRun(
        id=f"retrain-{uuid.uuid4().hex[:8]}",
        pipeline_name=pipeline_name,
        model_key=pipeline.model_key,
        trigger=pipeline.trigger,
        triggered_by=triggered_by,
        status=PipelineStatus.RUNNING,
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    runs = _load_runs()
    runs.append(run.model_dump())
    _save_runs(runs)

    return run

def execute_retraining(run_id: str) -> RetrainingRun:
    """Execute a retraining run by invoking the training script.

    This is a synchronous execution — for production use, integrate with
    a task queue (Celery, Ray, etc.).
    """
    runs = _load_runs()
    run_data = None
    run_idx = -1

    for i, r in enumerate(runs):
        if r["id"] == run_id:
            run_data = r
            run_idx = i
            break

    if run_data is None:
        raise KeyError(f"Run '{run_id}' not found.")

    run = RetrainingRun(**run_data)
    pipeline = get_pipeline(run.pipeline_name)

    try:
        # Build command as argument list (no shell injection)
        import shlex

        cmd_parts = shlex.split(pipeline.training_script)
        for k, v in pipeline.training_args.items():
            cmd_parts.append(f"--{k}")
            cmd_parts.append(str(v))
        if pipeline.dataset_path:
            cmd_parts.extend(["--dataset", pipeline.dataset_path])

        run.logs.append(f"Executing: {cmd_parts}")
        result = subprocess.run(
            cmd_parts,
            shell=False,
            capture_output=True,
            text=True,
            timeout=3600 * 4,  # 4 hour timeout
        )

        run.logs.append(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
        if result.stderr:
            run.logs.append(f"STDERR: {result.stderr[-1000:]}")

        if result.returncode == 0:
            run.status = PipelineStatus.COMPLETED
        else:
            run.status = PipelineStatus.FAILED
            run.logs.append(f"Exit code: {result.returncode}")

    except subprocess.TimeoutExpired:
        run.status = PipelineStatus.FAILED
        run.logs.append("Training timed out after 4 hours.")
    except Exception as e:
        run.status = PipelineStatus.FAILED
        run.logs.append(f"Error: {e}")

    run.completed_at = datetime.now(timezone.utc).isoformat()
    runs[run_idx] = run.model_dump()
    _save_runs(runs)

    return run

def get_run(run_id: str) -> RetrainingRun:
    """Get a retraining run by ID."""
    runs = _load_runs()
    for r in runs:
        if r["id"] == run_id:
            return RetrainingRun(**r)
    raise KeyError(f"Run '{run_id}' not found.")

def list_runs(
    pipeline_name: str | None = None, model_key: str | None = None
) -> list[RetrainingRun]:
    """List retraining runs, optionally filtered."""
    runs = _load_runs()
    result = [RetrainingRun(**r) for r in runs]
    if pipeline_name:
        result = [r for r in result if r.pipeline_name == pipeline_name]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result

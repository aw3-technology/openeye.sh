"""Batch job submission and tracking (story 186)."""

from __future__ import annotations

import uuid
from typing import Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import (
    BatchInferenceConfig,
    BatchInferenceJob,
    BatchJobStatus,
)

_BATCH_JOBS_PATH = OPENEYE_HOME / "batch_jobs.yaml"


def _load_jobs() -> list[dict]:
    return safe_load_yaml_list(_BATCH_JOBS_PATH)


def _save_jobs(jobs: list[dict]) -> None:
    atomic_save_yaml(_BATCH_JOBS_PATH, jobs)


def create_batch_job(config: BatchInferenceConfig) -> BatchInferenceJob:
    """Create a new batch inference job."""
    job = BatchInferenceJob(
        id=f"batch-{uuid.uuid4().hex[:8]}",
        config=config,
        status=BatchJobStatus.QUEUED,
    )
    jobs = _load_jobs()
    jobs.append(job.model_dump())
    _save_jobs(jobs)
    return job


def get_batch_job(job_id: str) -> BatchInferenceJob:
    """Get a batch job by ID."""
    jobs = _load_jobs()
    for j in jobs:
        if j["id"] == job_id:
            return BatchInferenceJob(**j)
    raise KeyError(f"Batch job '{job_id}' not found.")


def list_batch_jobs(model_key: Optional[str] = None) -> list[BatchInferenceJob]:
    """List batch jobs."""
    jobs = _load_jobs()
    result = [BatchInferenceJob(**j) for j in jobs]
    if model_key:
        result = [j for j in result if j.config.model_key == model_key]
    return result

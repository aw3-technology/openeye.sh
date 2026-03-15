"""API routes for retraining pipelines and batch inference (stories 185-186)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import BatchInferenceConfig, RetrainingPipelineConfig

router = APIRouter()

# ── Story 185: Retraining Pipelines ──────────────────────────────────

@router.post("/retraining/pipelines")
async def create_pipeline_endpoint(config: RetrainingPipelineConfig):
    """Create a new retraining pipeline."""
    from ..retraining import create_pipeline

    try:
        return create_pipeline(config).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/retraining/pipelines")
async def list_pipelines_endpoint(model_key: str | None = None):
    """List retraining pipelines."""
    from ..retraining import list_pipelines

    return [p.model_dump() for p in list_pipelines(model_key)]

@router.post("/retraining/pipelines/{pipeline_name}/trigger")
async def trigger_retraining_endpoint(pipeline_name: str, triggered_by: str = "manual"):
    """Trigger a retraining run."""
    from ..retraining import trigger_retraining

    try:
        return trigger_retraining(pipeline_name, triggered_by=triggered_by).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/retraining/runs")
async def list_runs_endpoint(pipeline_name: str | None = None, model_key: str | None = None):
    """List retraining runs."""
    from ..retraining import list_runs

    return [r.model_dump() for r in list_runs(pipeline_name, model_key)]

@router.get("/retraining/runs/{run_id}")
async def get_run_endpoint(run_id: str):
    """Get a retraining run by ID."""
    from ..retraining import get_run

    try:
        return get_run(run_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ── Story 186: Batch Inference ────────────────────────────────────────

@router.post("/batch-inference")
async def create_batch_job_endpoint(config: BatchInferenceConfig):
    """Create a batch inference job."""
    from ..batch_inference import create_batch_job

    return create_batch_job(config).model_dump()

@router.get("/batch-inference")
async def list_batch_jobs_endpoint(model_key: str | None = None):
    """List batch inference jobs."""
    from ..batch_inference import list_batch_jobs

    return [j.model_dump() for j in list_batch_jobs(model_key)]

@router.get("/batch-inference/{job_id}")
async def get_batch_job_endpoint(job_id: str):
    """Get a batch job by ID."""
    from ..batch_inference import get_batch_job

    try:
        return get_batch_job(job_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

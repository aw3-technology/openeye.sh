"""Routes for Story 185: Retraining Pipelines."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import RetrainingPipelineConfig

router = APIRouter()


@router.post("/retraining/pipelines")
async def create_pipeline_endpoint(config: RetrainingPipelineConfig):
    from ..retraining import create_pipeline
    try:
        return create_pipeline(config).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/retraining/pipelines")
async def list_pipelines_endpoint(model_key: Optional[str] = None):
    from ..retraining import list_pipelines
    return [p.model_dump() for p in list_pipelines(model_key)]

@router.post("/retraining/pipelines/{pipeline_name}/trigger")
async def trigger_retraining_endpoint(pipeline_name: str, triggered_by: str = "manual"):
    from ..retraining import trigger_retraining
    try:
        return trigger_retraining(pipeline_name, triggered_by=triggered_by).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/retraining/runs")
async def list_runs_endpoint(pipeline_name: Optional[str] = None, model_key: Optional[str] = None):
    from ..retraining import list_runs
    return [r.model_dump() for r in list_runs(pipeline_name, model_key)]

@router.get("/retraining/runs/{run_id}")
async def get_run_endpoint(run_id: str):
    from ..retraining import get_run
    try:
        return get_run(run_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

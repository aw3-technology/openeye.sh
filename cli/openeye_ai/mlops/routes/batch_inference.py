"""Routes for Story 186: Batch Inference."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import BatchInferenceConfig

router = APIRouter()


@router.post("/batch-inference")
async def create_batch_job_endpoint(config: BatchInferenceConfig):
    from ..batch_inference import create_batch_job
    return create_batch_job(config).model_dump()

@router.get("/batch-inference")
async def list_batch_jobs_endpoint(model_key: Optional[str] = None):
    from ..batch_inference import list_batch_jobs
    return [j.model_dump() for j in list_batch_jobs(model_key)]

@router.get("/batch-inference/{job_id}")
async def get_batch_job_endpoint(job_id: str):
    from ..batch_inference import get_batch_job
    try:
        return get_batch_job(job_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

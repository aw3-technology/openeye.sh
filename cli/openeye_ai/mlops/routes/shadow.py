"""Routes for Story 191: Shadow Mode."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import ShadowDeploymentConfig

router = APIRouter()


@router.post("/shadow-deployments")
async def create_shadow_endpoint(config: ShadowDeploymentConfig):
    from ..shadow_mode import create_shadow_deployment
    return create_shadow_deployment(config).model_dump()

@router.get("/shadow-deployments")
async def list_shadow_endpoint(model_key: Optional[str] = None):
    from ..shadow_mode import list_shadow_deployments
    return [d.model_dump() for d in list_shadow_deployments(model_key)]

@router.get("/shadow-deployments/{deployment_id}")
async def get_shadow_endpoint(deployment_id: str):
    from ..shadow_mode import get_shadow_deployment
    try:
        return get_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/shadow-deployments/{deployment_id}/complete")
async def complete_shadow_endpoint(deployment_id: str):
    from ..shadow_mode import complete_shadow_deployment
    try:
        return complete_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

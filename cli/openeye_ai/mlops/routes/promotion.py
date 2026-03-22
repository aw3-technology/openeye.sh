"""Routes for Story 183: Stage Promotion."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import ModelStage, PromotionRequest

router = APIRouter()


@router.post("/models/{model_key}/promote")
async def promote_model(model_key: str, version: str, target_stage: ModelStage, requester: str, reason: str = ""):
    """Request to promote a model version to a new stage."""
    from ..lifecycle import request_promotion
    try:
        req = PromotionRequest(model_key=model_key, version=version, target_stage=target_stage, requester=requester, reason=reason)
        record = request_promotion(req)
        return record.model_dump()
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/models/{model_key}/promote/approve")
async def approve_model_promotion(model_key: str, version: str, approver: str):
    """Approve a pending promotion."""
    from ..lifecycle import approve_promotion
    try:
        return approve_promotion(model_key, version, approver).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/models/{model_key}/promote/reject")
async def reject_model_promotion(model_key: str, version: str, approver: str, reason: str = ""):
    """Reject a pending promotion."""
    from ..lifecycle import reject_promotion
    try:
        return reject_promotion(model_key, version, approver, reason).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/promotions")
async def get_promotions(model_key: Optional[str] = None):
    """List promotion records."""
    from ..lifecycle import list_promotions
    return [p.model_dump() for p in list_promotions(model_key)]

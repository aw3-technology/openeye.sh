"""API routes for stage promotion and A/B testing (stories 183-184)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import ABTestConfig, ModelStage, PromotionRequest

router = APIRouter()

# ── Story 183: Stage Promotion ────────────────────────────────────────

@router.post("/models/{model_key}/promote")
async def promote_model(model_key: str, version: str, target_stage: ModelStage, requester: str, reason: str = ""):
    """Request to promote a model version to a new stage."""
    from ..lifecycle import request_promotion

    try:
        req = PromotionRequest(
            model_key=model_key,
            version=version,
            target_stage=target_stage,
            requester=requester,
            reason=reason,
        )
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
async def get_promotions(model_key: str | None = None):
    """List promotion records."""
    from ..lifecycle import list_promotions

    return [p.model_dump() for p in list_promotions(model_key)]

# ── Story 184: A/B Testing ────────────────────────────────────────────

@router.post("/ab-tests")
async def create_ab_test_endpoint(config: ABTestConfig):
    """Create a new A/B test."""
    from ..ab_testing import create_ab_test

    return create_ab_test(config).model_dump()

@router.get("/ab-tests")
async def list_ab_tests_endpoint(model_key: str | None = None):
    """List A/B tests."""
    from ..ab_testing import list_ab_tests

    return [t.model_dump() for t in list_ab_tests(model_key)]

@router.get("/ab-tests/{test_id}")
async def get_ab_test_endpoint(test_id: str):
    """Get an A/B test by ID."""
    from ..ab_testing import get_ab_test

    try:
        return get_ab_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/ab-tests/{test_id}/complete")
async def complete_ab_test_endpoint(test_id: str):
    """Complete an A/B test and determine winner."""
    from ..ab_testing import complete_ab_test

    try:
        return complete_ab_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

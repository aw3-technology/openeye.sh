"""Routes for Story 184: A/B Testing."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import ABTestConfig

router = APIRouter()


@router.post("/ab-tests")
async def create_ab_test_endpoint(config: ABTestConfig):
    """Create a new A/B test."""
    from ..ab_testing import create_ab_test
    return create_ab_test(config).model_dump()

@router.get("/ab-tests")
async def list_ab_tests_endpoint(model_key: Optional[str] = None):
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

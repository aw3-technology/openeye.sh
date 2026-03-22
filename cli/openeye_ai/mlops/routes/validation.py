"""Routes for Story 188: Validation Tests."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/validation-tests")
async def create_validation_test_endpoint(name: str, model_key: str, test_dataset: str, conditions: list[str], description: str = ""):
    from ..validation import create_validation_test
    try:
        return create_validation_test(name, model_key, test_dataset, conditions, description).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/validation-tests")
async def list_validation_tests_endpoint(model_key: Optional[str] = None):
    from ..validation import list_validation_tests
    return [t.model_dump() for t in list_validation_tests(model_key)]

@router.get("/validation-tests/{test_id}")
async def get_validation_test_endpoint(test_id: str):
    from ..validation import get_validation_test
    try:
        return get_validation_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/validation-runs")
async def list_validation_runs_endpoint(test_id: Optional[str] = None, model_key: Optional[str] = None):
    from ..validation import list_validation_runs
    return [r.model_dump() for r in list_validation_runs(test_id, model_key)]

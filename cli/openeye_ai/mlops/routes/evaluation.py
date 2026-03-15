"""API routes for benchmarks and validation tests (stories 187-188)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()

# ── Story 187: Benchmark Matrix ───────────────────────────────────────

@router.get("/benchmarks/{model_key}")
async def get_benchmarks_endpoint(model_key: str, model_version: str | None = None):
    """Get benchmark results for a model."""
    from ..benchmark_matrix import get_benchmark_results

    return [b.model_dump() for b in get_benchmark_results(model_key, model_version)]

# ── Story 188: Validation Tests ───────────────────────────────────────

@router.post("/validation-tests")
async def create_validation_test_endpoint(
    name: str,
    model_key: str,
    test_dataset: str,
    conditions: list[str],
    description: str = "",
):
    """Create a validation test."""
    from ..validation import create_validation_test

    try:
        return create_validation_test(name, model_key, test_dataset, conditions, description).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/validation-tests")
async def list_validation_tests_endpoint(model_key: str | None = None):
    """List validation tests."""
    from ..validation import list_validation_tests

    return [t.model_dump() for t in list_validation_tests(model_key)]

@router.get("/validation-tests/{test_id}")
async def get_validation_test_endpoint(test_id: str):
    """Get a validation test."""
    from ..validation import get_validation_test

    try:
        return get_validation_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/validation-runs")
async def list_validation_runs_endpoint(test_id: str | None = None, model_key: str | None = None):
    """List validation test runs."""
    from ..validation import list_validation_runs

    return [r.model_dump() for r in list_validation_runs(test_id, model_key)]

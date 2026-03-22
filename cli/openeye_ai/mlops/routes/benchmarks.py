"""Routes for Story 187: Benchmark Matrix."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

router = APIRouter()


@router.get("/benchmarks/{model_key}")
async def get_benchmarks_endpoint(model_key: str, model_version: Optional[str] = None):
    from ..benchmark_matrix import get_benchmark_results
    return [b.model_dump() for b in get_benchmark_results(model_key, model_version)]

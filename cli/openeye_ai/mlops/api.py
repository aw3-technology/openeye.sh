"""FastAPI router for MLOps endpoints (stories 181-192)."""

from __future__ import annotations

from fastapi import APIRouter

from .routes import (
    ab_testing,
    batch_inference,
    benchmarks,
    export,
    feedback,
    lineage,
    models,
    promotion,
    retraining,
    shadow,
    validation,
)

router = APIRouter(prefix="/mlops", tags=["mlops"])

router.include_router(models.router)
router.include_router(promotion.router)
router.include_router(ab_testing.router)
router.include_router(retraining.router)
router.include_router(batch_inference.router)
router.include_router(benchmarks.router)
router.include_router(validation.router)
router.include_router(lineage.router)
router.include_router(export.router)
router.include_router(shadow.router)
router.include_router(feedback.router)

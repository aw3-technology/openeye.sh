"""MLOps API routes — assembled from sub-routers."""

from fastapi import APIRouter

from .models import router as models_router
from .lifecycle import router as lifecycle_router
from .pipelines import router as pipelines_router
from .evaluation import router as evaluation_router
from .deployment import router as deployment_router
from .feedback import router as feedback_router

router = APIRouter(prefix="/mlops", tags=["mlops"])

router.include_router(models_router)
router.include_router(lifecycle_router)
router.include_router(pipelines_router)
router.include_router(evaluation_router)
router.include_router(deployment_router)
router.include_router(feedback_router)

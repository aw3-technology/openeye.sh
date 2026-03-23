"""Hosted V1 API routes — /v1/detect, /v1/depth, /v1/describe, /v1/models, /v1/usage.

These routes serve the ``openeye api`` CLI client.  They wrap the same
adapter-based inference as ``/predict`` but add:
  - Bearer-token API-key authentication
  - Per-call credit tracking
  - Usage / balance reporting
"""

from __future__ import annotations

from fastapi import APIRouter

from .v1_inference import describe, detect, depth
from .v1_usage import _UsageLedger, _default_ledger, models, usage

router = APIRouter(prefix="/v1", tags=["hosted-api"])

router.post("/detect")(detect)
router.post("/depth")(depth)
router.post("/describe")(describe)
router.get("/models")(models)
router.get("/usage")(usage)

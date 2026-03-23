"""REST routes for the perception pipeline.

Extracted from rest.py — provides the ``POST /perception`` endpoint that runs
the full perception pipeline (or falls back to basic detection) via a single
REST call, returning the same scene graph as the WebSocket endpoint.
"""

from __future__ import annotations

import io
import logging
import time

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import get_state

logger = logging.getLogger(__name__)

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

router = APIRouter()


@router.post("/perception")
async def perception_rest(
    request: Request,
    file: UploadFile,
):
    """Run the full perception pipeline on an uploaded image (REST)."""
    import numpy as np

    state = get_state(request)
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "File too large."}, status_code=413)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        return JSONResponse({"error": "Cannot decode image."}, status_code=400)

    img_w, img_h = img.size
    pipeline = state.get_pipeline()

    if pipeline is not None:
        frame_np = np.array(img)

        def run_pipeline():
            t0 = time.time()
            result = pipeline.process_frame(frame=frame_np)
            INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
            return result

        try:
            from openeye_ai.server.state import normalize_frame_bboxes

            perception_frame = await state.inference_queue.submit(run_pipeline)
            frame_dict = perception_frame.model_dump()
            frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
            return JSONResponse(frame_dict)
        except QueueFullError:
            return JSONResponse(
                {"error": "Server busy."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        except Exception as e:
            logger.error("Perception pipeline failed: %s", e)
            return JSONResponse({"error": "Pipeline failed."}, status_code=500)
    else:
        def run_basic():
            t0 = time.time()
            data = state.adapter.predict(img)
            INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
            return data

        try:
            result_data = await state.inference_queue.submit(run_basic)
        except QueueFullError:
            return JSONResponse(
                {"error": "Server busy."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        except Exception as e:
            logger.error("Detection failed: %s", e)
            return JSONResponse({"error": "Detection failed."}, status_code=500)

        result = PredictionResult(
            model=state.model_name,
            task=state.model_info["task"],
            image=ImageInfo(width=img_w, height=img_h, source=file.filename or "upload"),
            **result_data,
        )
        return JSONResponse(result.model_dump())

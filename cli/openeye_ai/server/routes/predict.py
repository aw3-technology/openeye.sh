"""/predict REST and /ws WebSocket inference routes."""

from __future__ import annotations

import io
import time

from fastapi import APIRouter, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.rate_limit import PREDICT_LIMIT, limiter
from openeye_ai.server.state import MAX_UPLOAD_BYTES, AppState
from openeye_ai.server.ws_utils import decode_base64_image, track_connection

import logging

logger = logging.getLogger(__name__)

def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.post("/predict")
    @limiter.limit(PREDICT_LIMIT)
    async def predict(
        request: Request,
        file: UploadFile,
        prompt: str | None = Query(
            None, description="Text prompt (for grounding-dino)"
        ),
    ):
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                {
                    "error": f"File too large ({len(contents)} bytes). Max: {MAX_UPLOAD_BYTES}."
                },
                status_code=413,
            )

        try:
            img = Image.open(io.BytesIO(contents)).convert("RGB")
        except (UnidentifiedImageError, Exception):
            return JSONResponse({"error": "Cannot decode image."}, status_code=400)

        w, h = img.size

        def run_inference():
            t0 = time.time()
            if prompt and hasattr(state.adapter, "predict_with_prompt"):
                data = state.adapter.predict_with_prompt(img, prompt)
            else:
                data = state.adapter.predict(img)
            INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
            return data

        try:
            result_data = await state.inference_queue.submit(run_inference)
        except QueueFullError:
            return JSONResponse(
                {"error": "Server busy. Try again later."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        except Exception as e:
            logger.error("Inference failed: %s", e)
            return JSONResponse(
                {"error": "Inference failed. Please try again."}, status_code=500
            )

        result = PredictionResult(
            model=state.model_name,
            task=state.model_info["task"],
            image=ImageInfo(width=w, height=h, source=file.filename or "upload"),
            **result_data,
        )
        return JSONResponse(result.model_dump())

    @router.websocket("/ws")
    async def websocket_predict(ws: WebSocket):
        async with track_connection(ws):
            try:
                while True:
                    data = await ws.receive_text()

                    if data == "camera":
                        await ws.send_json(
                            {
                                "error": "Server-side camera not supported via WebSocket. Send a base64 image."
                            }
                        )
                        continue

                    try:
                        img = decode_base64_image(data)
                    except ValueError:
                        await ws.send_json(
                            {"error": "Invalid image data. Send base64-encoded image."}
                        )
                        continue

                    w, h = img.size

                    def run_ws_inference():
                        t0 = time.time()
                        data = state.adapter.predict(img)
                        INFERENCE_LATENCY.labels(model=state.model_name).observe(
                            time.time() - t0
                        )
                        return data

                    try:
                        result_data = await state.inference_queue.submit(run_ws_inference)
                    except QueueFullError:
                        await ws.send_json({"error": "Server busy. Try again later."})
                        continue
                    except Exception as e:
                        logger.error("WS inference failed: %s", e)
                        await ws.send_json(
                            {"error": "Inference failed. Please try again."}
                        )
                        continue

                    result = PredictionResult(
                        model=state.model_name,
                        task=state.model_info["task"],
                        image=ImageInfo(width=w, height=h, source="websocket"),
                        **result_data,
                    )
                    await ws.send_json(result.model_dump())

            except WebSocketDisconnect:
                pass

    return router

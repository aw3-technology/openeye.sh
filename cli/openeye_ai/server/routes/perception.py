"""/ws/perception — perception pipeline WebSocket route."""

from __future__ import annotations

import logging
import time

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import AppState
from openeye_ai.server.ws_utils import decode_base64_image, track_connection

logger = logging.getLogger(__name__)


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.websocket("/ws/perception")
    async def websocket_perception(ws: WebSocket):
        async with track_connection(ws):
            pipeline = state.get_pipeline()
            try:
                while True:
                    data = await ws.receive_text()
                    try:
                        img = decode_base64_image(data)
                    except ValueError:
                        await ws.send_json({"error": "Invalid image data."})
                        continue

                    img_w, img_h = img.size

                    if pipeline is None:
                        # Fallback: run basic detection without full pipeline
                        def run_basic():
                            t0 = time.time()
                            result = state.adapter.predict(img)
                            INFERENCE_LATENCY.labels(model=state.model_name).observe(
                                time.time() - t0
                            )
                            return result

                        try:
                            result_data = await state.inference_queue.submit(run_basic)
                        except (QueueFullError, Exception):
                            await ws.send_json({"error": "Server busy."})
                            continue
                        result = PredictionResult(
                            model=state.model_name,
                            task=state.model_info["task"],
                            image=ImageInfo(
                                width=img_w, height=img_h, source="ws-perception"
                            ),
                            **result_data,
                        )
                        await ws.send_json(result.model_dump())
                        continue

                    frame_np = np.array(img)

                    def run_pipeline():
                        t0 = time.time()
                        result = pipeline.process_frame(frame=frame_np)
                        INFERENCE_LATENCY.labels(model=state.model_name).observe(
                            time.time() - t0
                        )
                        return result

                    try:
                        perception_frame = await state.inference_queue.submit(run_pipeline)
                    except QueueFullError:
                        await ws.send_json({"error": "Server busy."})
                        continue
                    except Exception as e:
                        logger.error("Pipeline failed: %s", e)
                        await ws.send_json(
                            {"error": "Pipeline failed. Please try again."}
                        )
                        continue

                    frame_dict = perception_frame.model_dump()
                    frame_dict = state.normalize_frame_bboxes(frame_dict, img_w, img_h)
                    await ws.send_json(frame_dict)

            except WebSocketDisconnect:
                pass

    return router

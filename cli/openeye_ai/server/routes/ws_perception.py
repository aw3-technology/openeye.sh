from __future__ import annotations

import logging
import time

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, INFERENCE_LATENCY
from openeye_ai.server.routes.ws_utils import decode_base64_image, submit_inference
from openeye_ai.server.state import get_state, normalize_frame_bboxes

logger = logging.getLogger(__name__)


async def websocket_perception(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)
    pipeline = state.get_pipeline()
    try:
        while True:
            data = await ws.receive_text()
            try:
                img, img_w, img_h = await decode_base64_image(data)
            except ValueError:
                await ws.send_json({"error": "Invalid image data."})
                continue

            if pipeline is None:
                # Fallback: run basic detection without full pipeline
                def run_basic():
                    t0 = time.time()
                    result = state.adapter.predict(img)
                    INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                    return result

                result_data = await submit_inference(
                    state.inference_queue, run_basic, ws,
                    error_msg="Server busy.",
                )
                if result_data is None:
                    continue
                result = PredictionResult(
                    model=state.model_name, task=state.model_info["task"],
                    image=ImageInfo(width=img_w, height=img_h, source="ws-perception"),
                    **result_data,
                )
                await ws.send_json(result.model_dump())
                continue

            frame_np = np.array(img)

            def run_pipeline():
                t0 = time.time()
                result = pipeline.process_frame(frame=frame_np)
                INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                return result

            perception_frame = await submit_inference(
                state.inference_queue, run_pipeline, ws,
                error_msg="Server busy.",
            )
            if perception_frame is None:
                continue

            frame_dict = perception_frame.model_dump()
            frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
            await ws.send_json(frame_dict)

    except WebSocketDisconnect:
        pass
    finally:
        ACTIVE_CONNECTIONS.dec()

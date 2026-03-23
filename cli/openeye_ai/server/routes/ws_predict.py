from __future__ import annotations

import logging
import time

from fastapi import WebSocket, WebSocketDisconnect

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, INFERENCE_LATENCY
from openeye_ai.server.routes.ws_utils import decode_base64_image, submit_inference
from openeye_ai.server.state import get_state

logger = logging.getLogger(__name__)


async def websocket_predict(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)
    try:
        while True:
            data = await ws.receive_text()

            if data == "camera":
                await ws.send_json({"error": "Server-side camera not supported via WebSocket. Send a base64 image."})
                continue

            # Expect base64-encoded image
            try:
                img, w, h = await decode_base64_image(data)
            except ValueError:
                await ws.send_json({"error": "Invalid image data. Send base64-encoded image."})
                continue

            def run_ws_inference():
                t0 = time.time()
                data = state.adapter.predict(img)
                INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                return data

            result_data = await submit_inference(
                state.inference_queue, run_ws_inference, ws,
                error_msg="Server busy. Try again later.",
            )
            if result_data is None:
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
    finally:
        ACTIVE_CONNECTIONS.dec()

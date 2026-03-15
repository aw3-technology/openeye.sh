"""/debug/* REST and /ws/debug WebSocket — visual debugger routes."""

from __future__ import annotations

import io
import logging

from fastapi import APIRouter, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.server.state import MAX_UPLOAD_BYTES, AppState
from openeye_ai.server.ws_utils import decode_base64_image, handle_ping, track_connection

logger = logging.getLogger(__name__)


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.post("/debug/analyze")
    async def debug_analyze(file: UploadFile):
        """Analyze a screenshot for UI issues using VLM."""
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

        from openeye_ai.debug.analyzer import UIDebugAnalyzer

        analyzer = UIDebugAnalyzer(
            vlm_model=state.runtime_config.get("vlm_model")
        )
        result = await analyzer.analyze_screenshot(img)
        return JSONResponse(result.model_dump())

    @router.post("/debug/diff")
    async def debug_diff(before: UploadFile, after: UploadFile):
        """Compare before/after screenshots for visual regressions."""
        before_bytes = await before.read()
        after_bytes = await after.read()

        try:
            img_before = Image.open(io.BytesIO(before_bytes)).convert("RGB")
            img_after = Image.open(io.BytesIO(after_bytes)).convert("RGB")
        except (UnidentifiedImageError, Exception):
            return JSONResponse(
                {"error": "Cannot decode image(s)."}, status_code=400
            )

        from openeye_ai.debug.analyzer import UIDebugAnalyzer

        analyzer = UIDebugAnalyzer(
            vlm_model=state.runtime_config.get("vlm_model")
        )
        result = await analyzer.diff_screenshots(img_before, img_after)

        # Try pixel diff if scikit-image available
        try:
            from openeye_ai.debug.diff_engine import PixelDiffEngine

            engine = PixelDiffEngine()
            pixel_result = engine.compute_diff(img_before, img_after)
            result.pixel_diff_pct = round(pixel_result["pixel_diff_pct"], 2)
            result.ssim = round(pixel_result["ssim"], 4)
        except ImportError:
            pass

        return JSONResponse(result.model_dump())

    @router.websocket("/ws/debug")
    async def websocket_debug(ws: WebSocket):
        """Live UI debug stream: receives frames, returns DebugAnalysis JSON."""
        async with track_connection(ws):
            from openeye_ai.debug.analyzer import UIDebugAnalyzer

            analyzer = UIDebugAnalyzer(
                vlm_model=state.runtime_config.get("vlm_model")
            )

            frame_count = 0
            last_summary = ""

            try:
                while True:
                    data = await ws.receive_text()

                    if await handle_ping(data, ws):
                        continue

                    try:
                        img = decode_base64_image(data)
                    except ValueError:
                        await ws.send_json({"error": "Invalid image data."})
                        continue

                    frame_count += 1
                    change_ctx = f"Previous: {last_summary}" if last_summary else ""

                    result = await analyzer.analyze_live_frame(
                        img, frame_count, 5.0, change_ctx
                    )
                    last_summary = result.summary

                    await ws.send_json(result.model_dump())

            except WebSocketDisconnect:
                pass

    return router

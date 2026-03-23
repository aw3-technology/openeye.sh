"""WebSocket streaming inference endpoint — extracted from v1_api."""

import base64
import hashlib
import json
import logging
from io import BytesIO

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from PIL import Image

from ..deps import ApiKeyContext, get_supabase
from ..services.credits_service import CREDIT_COSTS, CreditsService
from ..services.inference_service import InferenceService
from ..services.rate_limit_service import RateLimitService

logger = logging.getLogger(__name__)

stream_router = APIRouter(tags=["Hosted API"])

# Re-use shared service instances (same singletons as v1_api)
_credits_svc = CreditsService()
_inference_svc = InferenceService()


@stream_router.websocket("/stream")
async def stream(
    websocket: WebSocket,
    sb=Depends(get_supabase),
):
    """Real-time streaming inference over WebSocket.

    Protocol:
    1. Client connects and sends auth JSON: {"api_key": "oe_xxx"}
    2. Server validates and sends: {"status": "authenticated"}
    3. Client sends config (optional): {"model": "yolov8", "confidence": 0.3}
    4. Client sends base64-encoded image frames as text messages
    5. Server responds with detection results for each frame
    """
    # Step 1: Authenticate BEFORE accepting to avoid resource leaks
    try:
        # Accept first to receive the auth message (WebSocket protocol requires it)
        await websocket.accept()
        auth_msg = await websocket.receive_json()
    except Exception:
        try:
            await websocket.close(code=4001, reason="Expected JSON auth message")
        except Exception:
            pass
        return

    raw_key = auth_msg.get("api_key", "")
    if not raw_key or not raw_key.startswith("oe_"):
        await websocket.close(code=4001, reason="Invalid API key format")
        return

    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = (
        sb.table("api_keys")
        .select("id, user_id, key_prefix, scopes, rate_limit")
        .eq("key_hash", key_hash)
        .limit(1)
        .execute()
    )

    if not result.data:
        await websocket.close(code=4001, reason="Invalid API key")
        return

    row = result.data[0]
    ctx = ApiKeyContext(
        user_id=row["user_id"],
        api_key_id=row["id"],
        key_prefix=row["key_prefix"],
        scopes=row.get("scopes") or ["inference"],
        rate_limit=row.get("rate_limit") or 60,
    )

    await websocket.send_json({"status": "authenticated"})

    # Step 2: Optionally receive config
    model = "yolov8"
    confidence = 0.25

    # Step 3: Process frames
    rate_svc = RateLimitService(sb)
    cost = CREDIT_COSTS["stream_frame"]

    try:
        while True:
            msg = await websocket.receive_text()

            # Check if it's a config message
            if msg.startswith("{"):
                try:
                    config = json.loads(msg)
                    if "model" in config:
                        model = config["model"]
                    if "confidence" in config:
                        confidence = float(config["confidence"])
                    await websocket.send_json({"status": "configured", "model": model})
                    continue
                except (json.JSONDecodeError, ValueError):
                    pass

            # It's a frame — decode base64 image
            try:
                img_bytes = base64.b64decode(msg)
                image = Image.open(BytesIO(img_bytes)).convert("RGB")
            except Exception:
                await websocket.send_json({"error": "Cannot decode image frame"})
                continue

            # Rate limit check
            allowed, remaining, reset = await rate_svc.check_rate_limit(
                ctx.api_key_id, ctx.rate_limit
            )
            if not allowed:
                await websocket.send_json({"error": "Rate limit exceeded"})
                continue

            # Credit check
            ok = await _credits_svc.check_and_deduct(ctx.user_id, cost)
            if not ok:
                await websocket.send_json({"error": "Insufficient credits"})
                continue

            # Run inference — refund credits on failure
            try:
                result = await _inference_svc.detect(image, confidence=confidence)
            except Exception:
                await _credits_svc.refund(ctx.user_id, cost)
                await websocket.send_json({"error": "Inference failed"})
                continue

            await rate_svc.log_usage(
                api_key_id=ctx.api_key_id,
                user_id=ctx.user_id,
                endpoint="/v1/stream",
                model=model,
                credits_used=cost,
                inference_ms=result["inference_ms"],
                status_code=200,
            )

            await websocket.send_json({**result, "credits_used": cost})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", ctx.key_prefix)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        await websocket.close(code=1011, reason="Internal error")

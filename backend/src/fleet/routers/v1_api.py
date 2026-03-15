"""Hosted inference API — v1 endpoints authenticated by user API keys."""

import logging
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from PIL import Image

from ..deps import ApiKeyContext, get_api_key_auth, get_supabase
from ..models import (
    DepthResponse,
    DescribeResponse,
    DetectResponse,
    ErrorResponse,
    ModelInfo,
    UsageResponse,
)
from ..services.credits_service import CREDIT_COSTS, CreditsService
from ..services.inference_service import InferenceService
from ..services.rate_limit_service import RateLimitService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Hosted API"])

# Shared service instances
_credits_svc = CreditsService()
_inference_svc = InferenceService()

# Available models
MODELS = [
    ModelInfo(
        id="yolov8",
        name="YOLOv8 Nano",
        task="detection",
        credits_per_call=CREDIT_COSTS["detect"],
        description="Real-time object detection with 80 COCO classes.",
    ),
    ModelInfo(
        id="depth-anything-v2",
        name="Depth Anything V2",
        task="depth",
        credits_per_call=CREDIT_COSTS["depth"],
        description="Monocular depth estimation producing dense depth maps.",
    ),
    ModelInfo(
        id="gpt-4o",
        name="GPT-4o Vision",
        task="description",
        credits_per_call=CREDIT_COSTS["describe"],
        description="Scene description and visual Q&A powered by GPT-4o.",
    ),
]


def _rate_limit_headers(remaining: int, limit: int, reset: int) -> dict[str, str]:
    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(reset),
    }


_MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20MB
_MAX_PROMPT_LENGTH = 2000  # characters


async def _read_image(file: UploadFile) -> Image.Image:
    """Read and validate an uploaded image file, streaming to enforce size limit."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)  # 64KB chunks
        if not chunk:
            break
        total += len(chunk)
        if total > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 20MB.")
        chunks.append(chunk)
    contents = b"".join(chunks)
    try:
        return Image.open(BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot decode image. Supported formats: JPEG, PNG, WebP.")


async def _enforce_rate_limit(rate_svc: RateLimitService, ctx: ApiKeyContext) -> tuple[int, int]:
    """Check rate limit, raise 429 if exceeded. Returns (remaining, reset)."""
    allowed, remaining, reset = await rate_svc.check_rate_limit(ctx.api_key_id, ctx.rate_limit)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later.",
            headers=_rate_limit_headers(0, ctx.rate_limit, reset),
        )
    return remaining, reset


async def _enforce_credits(user_id: str, cost: int) -> None:
    """Check and deduct credits, raise 402 if insufficient."""
    if cost > 0:
        ok = await _credits_svc.check_and_deduct(user_id, cost)
        if not ok:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. This request costs {cost} credit(s).",
            )


# ── Endpoints ─────────────────────────────────────────────────


@router.post(
    "/detect",
    response_model=DetectResponse,
    responses={401: {"model": ErrorResponse}, 402: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
async def detect(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.25, ge=0.0, le=1.0),
    ctx: ApiKeyContext = Depends(get_api_key_auth),
    sb=Depends(get_supabase),
):
    """Run YOLOv8 object detection on an uploaded image."""
    rate_svc = RateLimitService(sb)
    remaining, reset = await _enforce_rate_limit(rate_svc, ctx)
    cost = CREDIT_COSTS["detect"]
    await _enforce_credits(ctx.user_id, cost)

    image = await _read_image(file)
    try:
        result = await _inference_svc.detect(image, confidence=confidence)
    except Exception:
        await _credits_svc.refund(ctx.user_id, cost)
        raise

    await rate_svc.log_usage(
        api_key_id=ctx.api_key_id,
        user_id=ctx.user_id,
        endpoint="/v1/detect",
        model="yolov8",
        credits_used=cost,
        inference_ms=result["inference_ms"],
        status_code=200,
    )

    return JSONResponse(
        content={**result, "credits_used": cost},
        headers=_rate_limit_headers(remaining - 1, ctx.rate_limit, reset),
    )


@router.post(
    "/depth",
    response_model=DepthResponse,
    responses={401: {"model": ErrorResponse}, 402: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
async def depth(
    file: UploadFile = File(...),
    ctx: ApiKeyContext = Depends(get_api_key_auth),
    sb=Depends(get_supabase),
):
    """Run depth estimation on an uploaded image."""
    rate_svc = RateLimitService(sb)
    remaining, reset = await _enforce_rate_limit(rate_svc, ctx)
    cost = CREDIT_COSTS["depth"]
    await _enforce_credits(ctx.user_id, cost)

    image = await _read_image(file)
    try:
        result = await _inference_svc.depth(image)
    except Exception:
        await _credits_svc.refund(ctx.user_id, cost)
        raise

    await rate_svc.log_usage(
        api_key_id=ctx.api_key_id,
        user_id=ctx.user_id,
        endpoint="/v1/depth",
        model="depth-anything-v2",
        credits_used=cost,
        inference_ms=result["inference_ms"],
        status_code=200,
    )

    return JSONResponse(
        content={**result, "credits_used": cost},
        headers=_rate_limit_headers(remaining - 1, ctx.rate_limit, reset),
    )


@router.post(
    "/describe",
    response_model=DescribeResponse,
    responses={401: {"model": ErrorResponse}, 402: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
async def describe(
    file: UploadFile = File(...),
    prompt: str = Form(default="Describe what you see in this image."),
    ctx: ApiKeyContext = Depends(get_api_key_auth),
    sb=Depends(get_supabase),
):
    """Run scene description on an uploaded image."""
    if len(prompt) > _MAX_PROMPT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Prompt too long. Maximum length is {_MAX_PROMPT_LENGTH} characters.",
        )

    rate_svc = RateLimitService(sb)
    remaining, reset = await _enforce_rate_limit(rate_svc, ctx)
    cost = CREDIT_COSTS["describe"]
    await _enforce_credits(ctx.user_id, cost)

    image = await _read_image(file)
    try:
        result = await _inference_svc.describe(image, prompt=prompt)
    except Exception:
        # Refund credits on inference failure
        await _credits_svc.refund(ctx.user_id, cost)
        raise

    await rate_svc.log_usage(
        api_key_id=ctx.api_key_id,
        user_id=ctx.user_id,
        endpoint="/v1/describe",
        model="gpt-4o",
        credits_used=cost,
        inference_ms=result["inference_ms"],
        status_code=200,
    )

    return JSONResponse(
        content={**result, "credits_used": cost},
        headers=_rate_limit_headers(remaining - 1, ctx.rate_limit, reset),
    )


@router.get("/models", response_model=list[ModelInfo])
async def list_models(ctx: ApiKeyContext = Depends(get_api_key_auth)):
    """List available models and their credit costs."""
    return [m.model_dump() for m in MODELS]


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    days: int = Query(default=30, ge=1, le=365),
    ctx: ApiKeyContext = Depends(get_api_key_auth),
    sb=Depends(get_supabase),
):
    """Get credit balance and usage statistics."""
    balance = await _credits_svc.get_balance(ctx.user_id)
    rate_svc = RateLimitService(sb)
    stats = await rate_svc.get_usage_stats(ctx.user_id, days=days)

    return {
        "balance": balance,
        **stats,
    }


@router.websocket("/stream")
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
    import hashlib

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
                import json

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
                import base64

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

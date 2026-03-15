---
title: POST /v1/depth
---

Run monocular depth estimation using Depth Anything V2. Returns a base64-encoded PNG depth map. Costs 2 credits per call.

### Request

```bash
curl -X POST https://api.openeye.ai/v1/depth \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@scene.jpg"
```

### Response

```json
{
  "model": "depth-anything-v2",
  "depth_map": "iVBORw0KGgoAAAANSUhEUgAA...",
  "image": { "width": 1280, "height": 720 },
  "inference_ms": 45.12,
  "credits_used": 2
}
```

The depth_map field is a base64-encoded grayscale PNG where brighter pixels are closer to the camera.

### Errors

| Status | Error | Description |
|--------|-------|-------------|
| 400 | invalid_image | Cannot decode the uploaded file |
| 401 | unauthorized | Missing or invalid API key |
| 402 | insufficient_credits | Not enough credits for this call |
| 413 | file_too_large | Image exceeds 20 MB limit |
| 429 | rate_limited | Too many requests in the current window |
| 503 | model_unavailable | Depth Anything V2 model is not loaded or temporarily unavailable |

> [!info] If the depth model is unavailable or inference fails, credits are automatically refunded.

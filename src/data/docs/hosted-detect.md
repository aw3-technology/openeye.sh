---
title: POST /v1/detect
---

Run YOLOv8 object detection on an uploaded image. Costs 1 credit per call.

### Request

```bash
curl -X POST https://api.openeye.ai/v1/detect \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@photo.jpg" \
  -F "confidence=0.3"
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| file | File | required | Image file (JPEG, PNG, WebP). Max 20 MB. |
| confidence | float | 0.25 | Minimum confidence threshold (0.0–1.0, server-validated) |

### Response

```json
{
  "model": "yolov8",
  "objects": [
    {
      "label": "person",
      "confidence": 0.9512,
      "bbox": { "x": 0.1234, "y": 0.2345, "w": 0.3456, "h": 0.4567 }
    },
    {
      "label": "dog",
      "confidence": 0.8734,
      "bbox": { "x": 0.5, "y": 0.6, "w": 0.2, "h": 0.25 }
    }
  ],
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 14.23,
  "credits_used": 1
}
```

### Errors

| Status | Error | Description |
|--------|-------|-------------|
| 400 | invalid_image | Cannot decode the uploaded file |
| 401 | unauthorized | Missing or invalid API key |
| 402 | insufficient_credits | Not enough credits for this call |
| 413 | file_too_large | Image exceeds 20 MB limit |
| 429 | rate_limited | Too many requests in the current window |

> [!info] If inference fails after credits are deducted, credits are automatically refunded.

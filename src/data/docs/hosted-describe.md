---
title: POST /v1/describe
---

Generate a natural language scene description using GPT-4o vision. Costs 3 credits per call.

### Request

```bash
curl -X POST https://api.openeye.ai/v1/describe \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@warehouse.jpg" \
  -F "prompt=Count the number of pallets and describe their arrangement"
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| file | File | required | Image file (JPEG, PNG, WebP). Max 20 MB. |
| prompt | string | "Describe what you see in this image." | Custom prompt for the vision model. Max 2,000 characters. |

### Response

```json
{
  "model": "gpt-4o",
  "description": "The image shows a warehouse with 12 pallets arranged in 3 rows of 4. The pallets appear to be loaded with cardboard boxes...",
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 2340.5,
  "credits_used": 3
}
```

### Errors

| Status | Error | Description |
|--------|-------|-------------|
| 400 | bad_request | Cannot decode image or prompt exceeds 2,000 characters |
| 401 | unauthorized | Missing or invalid API key |
| 402 | insufficient_credits | Not enough credits for this call |
| 413 | file_too_large | Image exceeds 20 MB limit |
| 429 | rate_limited | Too many requests in the current window |

> [!info] If inference fails after credits are deducted, credits are automatically refunded.

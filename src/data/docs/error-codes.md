---
title: Error Codes
---

### Self-Hosted Server

The self-hosted server returns errors as JSON with an `error` field:

```json
{"error": "Cannot decode image."}
```

| Status | Description |
|--------|-------------|
| 400 | Cannot decode image |
| 413 | File too large (max 20 MB) |
| 429 | Rate limit exceeded (30 requests/minute on /predict) |
| 500 | Inference failed |
| 503 | Server busy (inference queue full) |

### Hosted API

The hosted API returns structured errors with `error`, `message`, and `status_code` fields:

```json
{
  "error": "insufficient_credits",
  "message": "This request costs 2 credit(s).",
  "status_code": 402
}
```

| Status | Error | Description |
|--------|-------|-------------|
| 400 | bad_request | Invalid parameters or cannot decode image |
| 401 | unauthorized | Missing or invalid API key |
| 402 | insufficient_credits | Not enough credits for the request |
| 413 | payload_too_large | Image exceeds the 20 MB limit |
| 429 | rate_limited | Per-key rate limit exceeded |
| 500 | internal_error | Unexpected server error |

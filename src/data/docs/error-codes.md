---
title: Error Codes
---

### Hosted API

The hosted API at https://openeye.sh/v1 returns errors as JSON with a single `error` message:

```json
{"error": "Not enough credits. Buy more at https://openeye.sh/dashboard/settings/credits"}
```

| Status | When |
|--------|------|
| 400 | Missing `file`, `confidence` outside 0–1, prompt over 2,000 characters, malformed multipart body, or an image that can't be decoded |
| 401 | Missing API key, key not starting with oe_, or unknown/deleted key |
| 402 | Not enough credits — including accounts that have never bought credits |
| 404 | Unknown endpoint |
| 413 | Image over 4 MB, or a PNG over 25 megapixels |
| 415 | Not JPEG or PNG, or the request is not multipart/form-data |
| 429 | Per-key rate limit exceeded (see Rate Limits) |
| 500 | Unexpected server error |
| 501 | POST /v1/depth — depth is self-hosted only |
| 502 | POST /v1/describe — the upstream vision model failed |
| 503 | POST /v1/describe — scene description isn't enabled on the hosted API yet |

Credits are only taken once a request passes validation and the rate limit, and they are refunded if inference fails, so 4xx responses and failed inferences cost nothing.

### Self-Hosted Server

The self-hosted server returns errors as JSON with an `error` field on its own routes:

```json
{"error": "Cannot decode image."}
```

| Status | Description |
|--------|-------------|
| 400 | Cannot decode image |
| 413 | File too large (max 20 MB) |
| 429 | Rate limit exceeded (30 requests/minute on /predict) |
| 500 | Inference failed |
| 503 | Server busy (inference queue full), or VLM / perception pipeline not configured |

Its /v1 routes use FastAPI's format instead, `{"detail": "..."}`: 401 for a missing or invalid Bearer key, 400 for empty, oversized, or undecodable uploads.

### Fleet Control Plane

The fleet control plane uses FastAPI's `{"detail": "..."}` format: 400 for malformed IDs or values, 401 when no valid session token, API key, or device key is sent, 403 for a missing scope, 404 for resources you don't own, and 429 when rate limited.

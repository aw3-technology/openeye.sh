---
title: Credits System
---

Calls to the hosted API at https://openeye.sh/v1 are paid for with credits, handled by Cred (cred.diy). Buy them in the dashboard under Settings → Credits. Self-hosted inference via `openeye serve` is free.

### Credit Costs

| Endpoint | Model | Credits | Status |
|----------|-------|---------|--------|
| POST /v1/detect | YOLOv8 Nano | 1 | Live |
| POST /v1/describe | Qwen2.5-VL | 3 | Returns 503 until enabled |
| POST /v1/depth | Depth Anything V2 | 2 | Not hosted (501) |
| GET /v1/models | — | 0 | Live |
| GET /v1/usage | — | 0 | Live |

### How charging works

- The request is authenticated and the image decoded first; bad requests cost nothing
- The rate limit is checked, then the credits are deducted
- If inference fails afterwards, the credits are refunded
- If Cred refuses the deduction (not enough credits, or you have never bought any) you get 402 and nothing runs

All of your API keys draw on one balance. Check it with GET /v1/usage, `openeye api usage`, or the Settings → Credits page.

### Self-Hosted

All inference is available via the self-hosted CLI and API server at no cost:

```bash
openeye serve yolov8 --port 8000
curl -X POST http://localhost:8000/predict -F "file=@photo.jpg"
```

The self-hosted server's /v1 routes report a `credits_used` value and keep an in-memory tally for GET /v1/usage, but nothing is charged and the tally resets when the server restarts.

The self-hosted fleet control plane can also check credits against Cred for its own /v1 routes when CRED_API_KEY is set; without it, credits are disabled there and every call is allowed.

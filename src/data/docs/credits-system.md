---
title: Credits System
---

All hosted API calls are billed in credits. Every new account receives 1,000 free credits to get started.

### Credit Costs

| Endpoint | Model | Credits |
|----------|-------|---------|
| POST /v1/detect | YOLOv8 | 1 |
| POST /v1/depth | Depth Anything V2 | 2 |
| POST /v1/describe | GPT-4o Vision | 3 |
| WS /v1/stream | YOLOv8 (per frame) | 1 |
| GET /v1/models | — | 0 (free) |
| GET /v1/usage | — | 0 (free) |

### Purchasing Credits

Purchase additional credits from the Dashboard → Billing page. Credits never expire and are non-refundable.

### Automatic Refunds

If an inference call fails after credits have been deducted (e.g. model unavailable, internal error), credits are automatically refunded to your balance. No action is required on your part.

### Free Tier

- 1,000 free credits on signup
- Rate limit: 60 requests/minute
- All models and endpoints available
- No credit card required to start

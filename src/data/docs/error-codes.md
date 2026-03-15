---
title: Error Codes
---

All API errors return a consistent JSON body with error, message, and status_code fields.

```json
{
  "error": "insufficient_credits",
  "message": "This request costs 2 credit(s). Your balance is 0.",
  "status_code": 402
}
```

### HTTP Status Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | bad_request | Invalid parameters, cannot decode image, or prompt exceeds 2,000 characters |
| 401 | unauthorized | Missing, invalid, or expired API key |
| 402 | insufficient_credits | Not enough credits for this operation |
| 403 | forbidden | API key lacks required scope for this endpoint |
| 404 | not_found | Endpoint or resource does not exist |
| 413 | payload_too_large | Image exceeds the 20 MB limit |
| 422 | validation_error | Request body fails schema validation |
| 429 | rate_limited | Rate limit exceeded for this API key |
| 500 | internal_error | Unexpected server error — retry or contact support |
| 503 | model_unavailable | Model is loading or temporarily unavailable (credits are refunded) |

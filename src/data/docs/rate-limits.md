---
title: Rate Limits
---

Each API key has a per-minute rate limit (default 60 requests/min). The current limit and remaining quota are returned in every response.

### Response Headers

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit | Maximum requests per minute for this key |
| X-RateLimit-Remaining | Requests remaining in the current window |
| X-RateLimit-Reset | Seconds until the rate limit window resets |

### 429 Response Example

```text
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45

{
  "error": "rate_limited",
  "message": "Rate limit exceeded. Try again later.",
  "status_code": 429
}
```

### Fleet API Rate Limits

Fleet Management endpoints (devices, deployments, commands, etc.) have a separate in-memory rate limit of 120 requests per minute per IP address. This applies to all non-/v1 endpoints except /health. When exceeded, a 429 response is returned with a Retry-After header.

> [!info] Need higher rate limits? Upgrade your plan from the Dashboard or contact support.

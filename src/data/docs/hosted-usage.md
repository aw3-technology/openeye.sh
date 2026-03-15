---
title: GET /v1/usage
---

Get your current credit balance and usage statistics. No credits charged.

```bash
curl "https://api.openeye.ai/v1/usage?days=7" \
  -H "X-API-Key: oe_live_abc123"
```

### Response

```json
{
  "balance": 4750,
  "total_requests": 142,
  "total_credits_used": 250,
  "by_endpoint": {
    "/v1/detect": 98,
    "/v1/depth": 30,
    "/v1/describe": 14
  },
  "daily_credits": {
    "2026-03-15": 45,
    "2026-03-14": 62,
    "2026-03-13": 38
  },
  "truncated": false
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | int | 30 | Number of days to include (1–365) |

> [!info] If your usage exceeds 1,000 log entries in the requested period, results are truncated and the truncated field is set to true. Use a shorter time range for complete data.

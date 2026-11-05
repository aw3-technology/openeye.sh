---
title: GET /v1/usage
---

Your credit balance and API usage over the last `days` days (default 30, max 365).

```bash
curl "https://openeye.sh/v1/usage?days=7" \
  -H "Authorization: Bearer oe_your_key_here"
```

```json
{
  "balance": 480,
  "credits_remaining": 480,
  "total_requests": 20,
  "total_credits_used": 20,
  "credits_used": 20,
  "by_endpoint": { "/v1/detect": 20 },
  "daily_credits": { "2026-11-04": 12, "2026-11-05": 8 },
  "truncated": false
}
```

Usage covers every API key on your account. From the CLI: `openeye api usage --days 7`.

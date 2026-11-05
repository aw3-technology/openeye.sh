---
title: GET /v1/usage
---

Your credit balance and API usage over the last `days` days (default 30, clamped to 1–365). Free; needs an API key, and isn't rate limited.

```bash
curl "https://openeye.sh/v1/usage?days=7" \
  -H "Authorization: Bearer oe_your_key_here"
```

```json
{
  "balance": 480,
  "credits_remaining": 480,
  "total_requests": 20,
  "total_calls": 20,
  "total_credits_used": 20,
  "credits_used": 20,
  "by_endpoint": { "/v1/detect": 20 },
  "daily_credits": { "2026-11-04": 12, "2026-11-05": 8 },
  "truncated": false
}
```

### Fields

| Field | Meaning |
|-------|---------|
| balance | Current credit balance from Cred; null if the lookup failed (for example, no Cred account yet) |
| credits_remaining | Same as balance (kept for the openeye CLI) |
| total_requests | Successful billed calls in the window |
| total_calls | Same as total_requests (kept for the openeye CLI) |
| total_credits_used | Credits spent in the window |
| credits_used | Same as total_credits_used |
| by_endpoint | Call count per endpoint |
| daily_credits | Credits spent per day (YYYY-MM-DD, database time zone) |
| truncated | Always false today |

Usage covers every API key on your account. Only successful calls are logged, so rejected requests (401, 402, 429, ...) don't appear.

### From the CLI

```bash
openeye api usage --days 7
```

The CLI prints credits remaining, credits used, and total calls for the window. The dashboard's Settings → Credits page shows the same balance and lets you buy more.

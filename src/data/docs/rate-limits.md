---
title: Rate Limits
---

### Hosted API

Each API key allows 60 requests per minute by default, counted over a sliding 60-second window. The limit applies to the billed endpoints (POST /v1/detect and POST /v1/describe); GET /v1/models and GET /v1/usage are not rate limited.

Billed responses include:

| Header | Meaning |
|--------|---------|
| X-RateLimit-Limit | Requests allowed per minute for this key |
| X-RateLimit-Remaining | Requests left in the current window |
| Retry-After | Sent with 429: seconds to wait (60) |

When the limit is hit you get 429 with `{"error": "Rate limit exceeded (60 requests per minute)"}` and no credits are charged. Only successful calls count toward the window. Limits are per key, so separate keys for separate services keep one from starving another, but they share one credit balance.

```python
import time, requests

def detect(path, key):
    while True:
        r = requests.post(
            "https://openeye.sh/v1/detect",
            headers={"Authorization": f"Bearer {key}"},
            files={"file": open(path, "rb")},
        )
        if r.status_code != 429:
            r.raise_for_status()
            return r.json()
        time.sleep(int(r.headers.get("Retry-After", "60")))
```

### Self-Hosted Server

The self-hosted server (`openeye serve`) rate-limits POST /predict to 30 requests per minute per client IP; other routes are not rate limited. When exceeded, a 429 response is returned. Separately, the inference queue holds 16 waiting requests; past that, inference routes return 503 (see GET /queue/status).

### Fleet Control Plane

The self-hosted fleet control plane (backend, port 8001) is configured with an in-memory limit of 120 requests per minute per client IP on its fleet routes (/health and /v1 are exempt), answering 429 with a Retry-After header. The limit is per process and resets on restart.

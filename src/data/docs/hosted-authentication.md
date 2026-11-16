---
title: Authentication
---

The hosted API lives at `https://openeye.sh/v1` (`https://openeye.sh/api/v1` is an alias). GET /v1 (a JSON index of the endpoints) and GET /v1/models are public. GET /v1/usage and the inference endpoints (POST /v1/detect, /v1/describe, /v1/depth) need an API key. Unknown paths return `404` and unsupported methods `405` (with an `Allow` header) before the key is checked.

The API is meant for servers, scripts and the CLI: it sends no CORS headers, so browser JavaScript on another site can't call it directly. Keep the key on your server.

### Get a key

Sign in at https://openeye.sh/login (email and password, or Continue with 1Profile; Google and Apple appear when enabled). In the dashboard open Settings → API Keys and create a key. Keys start with `oe_` and are shown once: OpenEye stores only a SHA-256 hash and a short prefix, so a lost key can't be recovered — delete it and make a new one. Deleting a key revokes it immediately and leaves your other keys working.

### Send it

Pass the key as a Bearer token:

```bash
curl https://openeye.sh/v1/usage -H "Authorization: Bearer oe_your_key_here"
```

`X-API-Key: oe_...` is also accepted when there is no Authorization header, but Bearer is preferred. Missing keys, keys that don't start with `oe_`, and unknown or deleted keys all get `401`.

### Use it from the CLI

```bash
export OPENEYE_API_KEY=oe_your_key_here
openeye api models
```

The CLI sends the key as a Bearer token to https://openeye.sh (override with OPENEYE_API_URL or --server).

### Limits and billing

Each key allows 60 requests per minute by default (see Rate Limits). Usage and credits are tracked per account: GET /v1/usage covers every key you own, and all keys spend the same credit balance (see Credits System).

### Self-hosted server

`openeye serve` exposes the same `/v1` routes on your machine. It accepts any key starting with `oe_` (Bearer first, then X-API-Key, like the hosted API), or only the value of `OPENEYE_SERVER_API_KEY` when that is set. It does not check keys against your openeye.sh account.

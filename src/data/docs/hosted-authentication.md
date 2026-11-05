---
title: Authentication
---

The hosted API lives at `https://openeye.sh/v1`. Every request needs an API key, including GET /v1/models and GET /v1/usage.

### Get a key

Sign in at https://openeye.sh/login (email and password, or Continue with 1Profile; Google and Apple appear when enabled). In the dashboard open Settings → API Keys and create a key. Keys start with `oe_` and are shown once: OpenEye stores only a SHA-256 hash and a short prefix, so a lost key can't be recovered — delete it and make a new one. Deleting a key revokes it immediately and leaves your other keys working.

### Send it

Pass the key as a Bearer token:

```bash
curl https://openeye.sh/v1/models \
  -H "Authorization: Bearer oe_your_key_here"
```

`X-API-Key: oe_...` is also accepted when there is no Bearer header. Missing keys, keys that don't start with `oe_`, and unknown or deleted keys all get `401`.

### Use it from the CLI

```bash
export OPENEYE_API_KEY=oe_your_key_here
openeye api models
```

The CLI sends the key as a Bearer token to https://openeye.sh (override with OPENEYE_API_URL or --server).

### Limits and billing

Each key allows 60 requests per minute by default (see Rate Limits). Usage and credits are tracked per account: GET /v1/usage covers every key you own, and all keys spend the same credit balance (see Credits System).

### Self-hosted server

`openeye serve` exposes the same `/v1` routes on your machine. It accepts any Bearer key starting with `oe_`, or only the value of `OPENEYE_SERVER_API_KEY` when that is set. It does not read X-API-Key and does not check keys against your openeye.sh account.

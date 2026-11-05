---
title: Authentication
---

The hosted API lives at `https://openeye.sh/v1`. Every request needs an API key.

### Get a key

Create one in the dashboard under **Settings → API Keys**. Keys start with `oe_` and are shown once; OpenEye stores only a hash.

### Send it

Pass the key as a Bearer token:

```bash
curl https://openeye.sh/v1/models \
  -H "Authorization: Bearer oe_your_key_here"
```

`X-API-Key: oe_...` is also accepted. Requests without a valid key get `401`.

### Self-hosted server

`openeye serve` exposes the same `/v1` routes on your machine. It accepts any key starting with `oe_`, or only the value of `OPENEYE_SERVER_API_KEY` when that is set.

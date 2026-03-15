---
title: Authentication
---

All hosted API endpoints require an API key prefixed with oe_. Create keys from the Dashboard → API Keys page. Keys are stored as SHA-256 hashes — the plaintext is shown only once at creation time.

### Sending Your Key

Pass your API key in either header (not both):

```bash
# Option 1 — Authorization header
curl -H "Authorization: Bearer oe_live_abc123..." ...

# Option 2 — X-API-Key header
curl -H "X-API-Key: oe_live_abc123..." ...
```

### Key Formats

| Prefix | Environment | Description |
|--------|-------------|-------------|
| oe_live_ | Production | Full access, billed against your credit balance |
| oe_test_ | Sandbox | Returns mock responses, no credits charged |

### Key Scopes

Each API key has configurable scopes that control access:

| Scope | Endpoints |
|-------|-----------|
| inference | /v1/detect, /v1/depth, /v1/describe, /v1/stream |
| fleet | /devices, /deployments, /commands (requires JWT) |

### Security Notes

- Never expose API keys in client-side code or public repositories
- Rotate keys immediately if compromised — delete from Dashboard and create a new one
- Each key has configurable scopes and a per-minute rate limit (default: 60 req/min)
- last_used_at is updated with a UTC timestamp on every authenticated request
- Image uploads are streamed in 64 KB chunks to enforce the 20 MB size limit without buffering the entire file

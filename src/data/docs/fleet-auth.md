---
title: Fleet Authentication
---

The Fleet Management API uses Supabase JWT authentication (not API keys). This keeps fleet operations tied to your user session and dashboard.

### JWT vs API Key Auth

| Feature | JWT (Fleet API) | API Key (Hosted API) |
|---------|-----------------|----------------------|
| Header | Authorization: Bearer <jwt> | X-API-Key: oe_xxx |
| Used by | Dashboard, admin scripts | Application code, CI/CD |
| Scope | Full fleet management | Inference endpoints only |
| Billing | No credits charged | Credits per API call |

### Device API Keys

Edge devices authenticate with device-specific API keys (X-Device-API-Key header), generated at device registration. These are separate from the oe_ user API keys.

### Fleet Rate Limiting

Fleet endpoints are rate-limited to 120 requests per minute per IP address (in-memory sliding window). This is separate from the per-key rate limits on /v1 hosted API endpoints. Health checks and /v1 routes are excluded from fleet rate limiting.

### CORS Configuration

CORS origins are configurable via the CORS_ORIGINS environment variable (comma-separated). Defaults to http://localhost:5173,http://localhost:3000 for local development.

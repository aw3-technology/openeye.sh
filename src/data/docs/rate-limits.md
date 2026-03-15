---
title: Rate Limits
---

### Self-Hosted Server

The self-hosted server (`openeye serve`) does not enforce rate limits by default. You can configure rate limiting in your reverse proxy or load balancer.

### Fleet API Rate Limits

Fleet Management endpoints (devices, deployments, commands) have an in-memory rate limit of 120 requests per minute per IP address. When exceeded, a 429 response is returned with a `Retry-After` header.

> [!warning] Hosted API rate limits (per-key limits, response headers) are planned for when the hosted API launches.

---
title: Rate Limits
---

### Self-Hosted Server

The self-hosted server (`openeye serve`) rate-limits the `POST /predict` endpoint to 30 requests per minute per IP address. When exceeded, a 429 response is returned.

### Fleet API Rate Limits

Fleet Management endpoints (devices, deployments, commands) have an in-memory rate limit of 120 requests per minute per IP address. When exceeded, a 429 response is returned with a `Retry-After` header.

### Hosted API Rate Limits

Each API key allows 60 requests per minute by default. Every response includes `X-RateLimit-Limit` and `X-RateLimit-Remaining`; when the limit is hit you get `429` with a `Retry-After` header (in seconds).

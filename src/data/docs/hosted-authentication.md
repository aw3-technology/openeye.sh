---
title: Authentication
---

> [!warning] The hosted API with API key authentication is not yet available. This page describes planned functionality.

### Self-Hosted Server

The self-hosted server (`openeye serve`) does not require authentication by default. To add authentication to your self-hosted deployment, configure it in your reverse proxy or application layer.

```bash
# Start the server (no auth required)
openeye serve yolov8 --port 8000

# Query it directly
curl -X POST http://localhost:8000/predict -F "file=@photo.jpg"
```

### Planned Hosted API Authentication

When the hosted API launches, API keys will be prefixed with `oe_` and passed via the `X-API-Key` or `Authorization` header.

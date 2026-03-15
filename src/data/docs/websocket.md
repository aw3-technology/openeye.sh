---
title: WebSocket
---

Real-time inference over WebSocket at ws://host:port/ws.

- Send: Base64-encoded image as text frame
- Receive: JSON prediction result (same schema as /predict)
- Error: {"error": "description"} if inference fails

### Additional Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /metrics | Prometheus metrics (when enabled) |
| GET /queue/status | Inference queue status (when rate limiting enabled) |
| GET / | Browser dashboard (HTML) |

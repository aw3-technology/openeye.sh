---
title: WebSocket
---

Real-time inference over WebSocket at `ws://host:port/ws`.

- Send: Base64-encoded image as text frame
- Receive: JSON prediction result (same schema as `/predict`)
- Error: `{"error": "description"}` if inference fails

### Additional Endpoints

| Endpoint | Description |
|----------|-------------|
| GET / | Browser dashboard (HTML) |
| GET /health | Server health check |
| GET /config | Read runtime configuration |
| PUT /config | Update runtime configuration |

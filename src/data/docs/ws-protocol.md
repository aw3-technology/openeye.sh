---
title: Streaming Protocol
---

The /v1/stream WebSocket endpoint enables real-time inference on video frames. Each frame costs 1 credit.

### Connection Steps

- 1. Connect to wss://api.openeye.ai/v1/stream
- 2. Send auth JSON: {"api_key": "oe_live_abc123"}
- 3. Receive: {"status": "authenticated"}
- 4. (Optional) Send config: {"model": "yolov8", "confidence": 0.3}
- 5. Send base64-encoded image frames as text messages
- 6. Receive JSON detection results for each frame

### Auth Handshake

```json
// Client sends:
{ "api_key": "oe_live_abc123" }

// Server responds:
{ "status": "authenticated" }

// Or on failure:
// Connection closed with code 4001
```

### Config Message (Optional)

```json
// Client sends:
{ "model": "yolov8", "confidence": 0.3 }

// Server responds:
{ "status": "configured", "model": "yolov8" }
```

### Frame Format

Send each frame as a base64-encoded string (no data URI prefix). The server responds with the same JSON schema as POST /v1/detect.

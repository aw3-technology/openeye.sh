---
title: Streaming Protocol
---

### Self-Hosted WebSocket

The self-hosted server provides a WebSocket endpoint at `ws://host:port/ws` for real-time inference.

### Connection Steps

- 1. Connect to `ws://localhost:8000/ws`
- 2. Send base64-encoded image frames as text messages
- 3. Receive JSON detection results for each frame

### Frame Format

Send each frame as a base64-encoded string (no data URI prefix). The server responds with the same JSON schema as `POST /predict`.

### Example

```python
import asyncio, base64, json, websockets

async def stream():
    async with websockets.connect("ws://localhost:8000/ws") as ws:
        with open("frame.jpg", "rb") as f:
            await ws.send(base64.b64encode(f.read()).decode())
        result = json.loads(await ws.recv())
        print(result["objects"])

asyncio.run(stream())
```

> [!warning] Hosted WebSocket streaming (wss://api.openeye.ai/v1/stream) with API key authentication is planned but not yet available.

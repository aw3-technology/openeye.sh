---
title: WebSocket Examples
---

### Python (websockets)

```python
import asyncio
import base64
import json
import websockets

async def stream_camera():
    uri = "wss://api.openeye.ai/v1/stream"
    async with websockets.connect(uri) as ws:
        # Authenticate
        await ws.send(json.dumps({"api_key": "oe_live_abc123"}))
        auth = json.loads(await ws.recv())
        assert auth["status"] == "authenticated"

        # Configure
        await ws.send(json.dumps({"model": "yolov8", "confidence": 0.3}))
        await ws.recv()  # configured ack

        # Send frames
        with open("frame.jpg", "rb") as f:
            frame_b64 = base64.b64encode(f.read()).decode()
        await ws.send(frame_b64)
        result = json.loads(await ws.recv())
        print(result["objects"])

asyncio.run(stream_camera())
```

### JavaScript (Browser)

```javascript
const ws = new WebSocket("wss://api.openeye.ai/v1/stream");

ws.onopen = () => {
  ws.send(JSON.stringify({ api_key: "oe_live_abc123" }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.status === "authenticated") {
    // Send config then frames
    ws.send(JSON.stringify({ model: "yolov8" }));
  } else if (msg.objects) {
    console.log("Detected:", msg.objects.length, "objects");
  }
};

// Send a frame from canvas
function sendFrame(canvas) {
  canvas.toBlob((blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      ws.send(b64);
    };
    reader.readAsDataURL(blob);
  }, "image/jpeg");
}
```

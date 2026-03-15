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
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as ws:
        # Send a frame
        with open("frame.jpg", "rb") as f:
            frame_b64 = base64.b64encode(f.read()).decode()
        await ws.send(frame_b64)
        result = json.loads(await ws.recv())
        print(result["objects"])

asyncio.run(stream_camera())
```

### JavaScript (Browser)

```javascript
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onopen = () => {
  console.log("Connected — send base64 frames");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.objects) {
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

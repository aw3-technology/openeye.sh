---
title: WebSocket Examples
---

### Basic Inference — Python (websockets)

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

### Basic Inference — JavaScript (Browser)

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

### Perception Pipeline — Python

```python
import asyncio, base64, json, websockets

async def stream_perception():
    async with websockets.connect("ws://localhost:8000/ws/perception") as ws:
        with open("frame.jpg", "rb") as f:
            await ws.send(base64.b64encode(f.read()).decode())
        result = json.loads(await ws.recv())
        print("Scene:", result.get("scene_description"))
        print("Objects:", len(result.get("objects", [])))
        print("Scene graph nodes:", len(result.get("scene_graph", {}).get("nodes", [])))

asyncio.run(stream_perception())
```

### VLM Reasoning — Python

```python
import asyncio, base64, json, websockets

async def vlm_analyze():
    async with websockets.connect("ws://localhost:8000/ws/vlm") as ws:
        with open("frame.jpg", "rb") as f:
            await ws.send(base64.b64encode(f.read()).decode())
        result = json.loads(await ws.recv())
        print("Analysis:", result["description"])
        print("Latency:", result["latency_ms"], "ms")

asyncio.run(vlm_analyze())
```

### Agentic Loop — Python

```python
import asyncio, base64, json, websockets

async def agentic_loop():
    async with websockets.connect("ws://localhost:8000/ws/agentic") as ws:
        with open("frame.jpg", "rb") as f:
            frame_b64 = base64.b64encode(f.read()).decode()

        # Set a goal and send frame
        await ws.send(json.dumps({
            "frame": frame_b64,
            "set_goal": "monitor workspace for safety hazards"
        }))
        result = json.loads(await ws.recv())
        print("Detections:", len(result["detections"]))
        print("Goal:", result["goal"])
        print("VLM:", result["vlm_reasoning"])
        print("Memory:", result["memory"]["frame_count"], "frames tracked")

asyncio.run(agentic_loop())
```

### Agentic Loop — JavaScript (Browser)

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/agentic");

ws.onopen = () => {
  // Capture frame from video element and send with goal
  const canvas = document.createElement("canvas");
  const video = document.querySelector("video");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      ws.send(JSON.stringify({
        frame: reader.result.split(",")[1],
        set_goal: "monitor workspace for safety hazards"
      }));
    };
    reader.readAsDataURL(blob);
  }, "image/jpeg");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "agentic_frame") {
    console.log("Detections:", msg.detections.length);
    console.log("Action plan:", msg.action_plan);
    console.log("Safety alerts:", msg.safety_alerts);
  }
};
```

---
title: Python
---

### Object Detection (self-hosted)

```python
import requests

resp = requests.post(
    "http://localhost:8000/predict",
    files={"file": open("photo.jpg", "rb")},
)
resp.raise_for_status()
data = resp.json()

for obj in data["objects"]:
    print(f'{obj["label"]}: {obj["confidence"]:.0%}')
```

### Async Detection (httpx)

```python
import httpx
import asyncio

async def detect(image_path: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://localhost:8000/predict",
            files={"file": open(image_path, "rb")},
        )
        resp.raise_for_status()
        return resp.json()

result = asyncio.run(detect("photo.jpg"))
print(f'Found {len(result["objects"])} objects')
```

### WebSocket Streaming

```python
import asyncio, base64, json, websockets

async def stream():
    async with websockets.connect("ws://localhost:8000/ws") as ws:
        with open("frame.jpg", "rb") as f:
            await ws.send(base64.b64encode(f.read()).decode())
        print(json.loads(await ws.recv()))

asyncio.run(stream())
```

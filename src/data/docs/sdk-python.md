---
title: Python
---

### Object Detection (requests)

```python
import requests

resp = requests.post(
    "https://api.openeye.ai/v1/detect",
    headers={"X-API-Key": "oe_live_abc123"},
    files={"file": open("photo.jpg", "rb")},
    data={"confidence": 0.3},
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
            "https://api.openeye.ai/v1/detect",
            headers={"X-API-Key": "oe_live_abc123"},
            files={"file": open(image_path, "rb")},
        )
        resp.raise_for_status()
        return resp.json()

result = asyncio.run(detect("photo.jpg"))
print(f'Found {len(result["objects"])} objects')
```

### WebSocket Streaming (websockets)

```python
import asyncio, base64, json, websockets

async def stream():
    async with websockets.connect("wss://api.openeye.ai/v1/stream") as ws:
        await ws.send(json.dumps({"api_key": "oe_live_abc123"}))
        auth = json.loads(await ws.recv())
        print(auth)  # {"status": "authenticated"}

        with open("frame.jpg", "rb") as f:
            await ws.send(base64.b64encode(f.read()).decode())
        print(json.loads(await ws.recv()))

asyncio.run(stream())
```

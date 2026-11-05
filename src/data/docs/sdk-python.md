---
title: Python
---

### Object Detection (hosted API)

```python
import os
import requests

resp = requests.post(
    "https://openeye.sh/v1/detect",
    headers={"Authorization": f"Bearer {os.environ['OPENEYE_API_KEY']}"},
    files={"file": open("photo.jpg", "rb")},
    data={"confidence": 0.3},
)
if resp.status_code == 402:
    raise SystemExit("Out of credits: buy more in Dashboard → Settings → Credits")
resp.raise_for_status()
data = resp.json()
print(f'{len(data["objects"])} objects, {data["credits_used"]} credit(s)')
```

Usage and balance:

```python
usage = requests.get(
    "https://openeye.sh/v1/usage",
    headers={"Authorization": f"Bearer {os.environ['OPENEYE_API_KEY']}"},
    params={"days": 7},
).json()
print(usage["balance"], usage["total_requests"])
```

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

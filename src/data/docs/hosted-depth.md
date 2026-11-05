---
title: POST /v1/depth
---

> [!warning] Depth estimation isn't on the hosted API yet; `POST https://openeye.sh/v1/depth` returns `501`. Run it on your own hardware with `openeye serve` today.

### Self-hosted

```bash
openeye pull depth-anything
openeye serve depth-anything --port 8000

curl -X POST http://localhost:8000/v1/depth \
  -H "Authorization: Bearer oe_local" \
  -F "file=@scene.jpg"
```

### Response

```json
{
  "model": "depth-anything-v2",
  "depth_map": "iVBORw0KGgoAAAANSUhEUgAA...",
  "image": { "width": 1280, "height": 720 },
  "inference_ms": 45.12
}
```

`depth_map` is a base64-encoded grayscale PNG where brighter pixels are closer to the camera.

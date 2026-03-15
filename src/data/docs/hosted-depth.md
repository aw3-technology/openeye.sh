---
title: POST /v1/depth
---

> [!warning] The hosted API endpoint is not yet available. This page describes planned functionality. Use `openeye serve` for self-hosted inference today.

### Self-Hosted Equivalent

```bash
openeye serve depth-anything --port 8000

curl -X POST http://localhost:8000/predict \
  -F "file=@scene.jpg"
```

### Response Schema

```json
{
  "model": "depth-anything-v2",
  "depth_map": "iVBORw0KGgoAAAANSUhEUgAA...",
  "image": { "width": 1280, "height": 720 },
  "inference_ms": 45.12
}
```

The `depth_map` field is a base64-encoded grayscale PNG where brighter pixels are closer to the camera.

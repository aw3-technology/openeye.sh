---
title: POST /v1/depth
---

> [!warning] Depth estimation isn't on the hosted API yet: POST https://openeye.sh/v1/depth returns 501 (after checking your API key; no credits are charged). GET /v1/models lists depth-anything-v2 with "available": false. Run depth on your own hardware with openeye serve today.

When depth comes to the hosted API it is priced at 2 credits per call.

### Self-hosted

```bash
openeye pull depth-anything
openeye serve depth-anything --port 8000

curl -X POST http://localhost:8000/v1/depth \
  -H "Authorization: Bearer oe_local" \
  -F "file=@scene.jpg"
```

Or with the CLI: `openeye api depth scene.jpg --server http://localhost:8000` (needs OPENEYE_API_KEY set to any oe_ value).

### Response (self-hosted)

```json
{
  "width": 1280,
  "height": 720,
  "credits_used": 2,
  "depth_map": "iVBORw0KGgoAAAANSUhEUgAA...",
  "inference_ms": 45.12
}
```

`depth_map` is a base64-encoded grayscale PNG where brighter pixels are closer to the camera. `credits_used` is only counted by the local server; nothing is charged.

---
title: REST Endpoints
---

### GET /health

Health check endpoint.

```json
{"status": "ok", "model": "yolov8"}
```

### POST /predict

Run inference on an uploaded image. Request: Multipart form with file field (JPEG/PNG, max 20MB).

```json
{
  "model": "yolov8",
  "task": "detection",
  "timestamp": "2026-01-15T10:30:00Z",
  "image": {"width": 640, "height": 480, "source": "upload.jpg"},
  "objects": [
    {"label": "person", "confidence": 0.95,
     "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}
  ],
  "depth_map": null,
  "inference_ms": 12.3
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Cannot decode image |
| 413 | File too large |
| 500 | Inference failed |

### GET /config & PUT /config

Get or update runtime configuration. PUT body: JSON object with config fields to update.

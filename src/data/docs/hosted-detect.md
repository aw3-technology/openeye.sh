---
title: POST /v1/detect
---

> [!warning] The hosted API endpoint is not yet available. This page describes planned functionality. Use `openeye serve` for self-hosted inference today.

### Self-Hosted Equivalent

```bash
openeye serve yolov8 --port 8000

curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

### Planned Hosted Endpoint

When the hosted API launches, object detection will be available at:

```bash
curl -X POST https://api.openeye.ai/v1/detect \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@photo.jpg" \
  -F "confidence=0.3"
```

### Response Schema

Both self-hosted and hosted APIs return the same JSON schema:

```json
{
  "model": "yolov8",
  "objects": [
    {
      "label": "person",
      "confidence": 0.9512,
      "bbox": { "x": 0.1234, "y": 0.2345, "w": 0.3456, "h": 0.4567 }
    }
  ],
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 14.23
}
```

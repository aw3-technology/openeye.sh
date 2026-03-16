---
title: Credits System
---

> [!warning] The hosted API and credits system are not yet available. This page describes planned functionality. Self-hosted inference via `openeye serve` is available today at no cost.

### Planned Credit Costs

| Endpoint | Model | Credits |
|----------|-------|---------|
| POST /v1/detect | YOLOv8 | 1 |
| POST /v1/depth | Depth Anything V2 | 2 |
| POST /v1/describe | VLM | 3 |
| WS /v1/stream (per frame) | YOLOv8 | 1 |

### Self-Hosted Alternative

All inference is available today via the self-hosted CLI and API server at no cost:

```bash
openeye serve yolov8 --port 8000
curl -X POST http://localhost:8000/predict -F "file=@photo.jpg"
```

---
title: Credits System
---

Calls to the hosted API at `https://openeye.sh/v1` are paid for with credits. Buy them in the dashboard under **Settings → Credits**. Self-hosted inference via `openeye serve` is free.

### Credit Costs

| Endpoint | Model | Credits |
|----------|-------|---------|
| POST /v1/detect | YOLOv8 | 1 |
| POST /v1/depth | Depth Anything V2 | 2 |
| POST /v1/describe | VLM | 3 |

Credits are taken when a request starts and refunded if inference fails. Check your balance with `GET /v1/usage`.

### Self-Hosted

All inference is available today via the self-hosted CLI and API server at no cost:

```bash
openeye serve yolov8 --port 8000
curl -X POST http://localhost:8000/predict -F "file=@photo.jpg"
```

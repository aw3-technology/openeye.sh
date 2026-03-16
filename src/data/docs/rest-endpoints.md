---
title: REST Endpoints
---

The self-hosted server (`openeye serve`) runs on port 8000 by default and exposes the following REST endpoints.

### GET /health

Health check endpoint.

```json
{
  "status": "ok",
  "model": "yolov8",
  "model_loaded": true,
  "uptime_seconds": 123.4
}
```

### POST /predict

Run inference on an uploaded image. Request: Multipart form with `file` field (JPEG/PNG, max 20MB).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| prompt | string | null | Text prompt for open-vocabulary models (e.g. grounding-dino) |

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
  "segmentation_masks": null,
  "vla_action": null,
  "inference_ms": 12.3
}
```

### GET /config & PUT /config

Get or update runtime configuration. PUT body: JSON object with config fields to update.

### GET /metrics

Prometheus-format metrics endpoint. Returns counters and histograms for request counts, latencies, and inference times.

### GET /queue/status

Inference queue status.

```json
{"active": 0, "queued": 2}
```

### GET /nebius/stats

Nebius Token Factory VLM usage statistics.

```json
{
  "total_calls": 42,
  "total_tokens_estimated": 8400,
  "total_latency_ms": 21000.0,
  "avg_latency_ms": 500.0,
  "errors": 1,
  "last_call_at": 1710500000.0,
  "model": "Qwen/Qwen2.5-VL-72B-Instruct",
  "provider": "Nebius Token Factory",
  "configured": true,
  "uptime_seconds": 3600.0
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Cannot decode image |
| 413 | File too large |
| 429 | Rate limit exceeded (30 requests/minute on /predict) |
| 500 | Inference failed |
| 503 | Server busy (queue full) |

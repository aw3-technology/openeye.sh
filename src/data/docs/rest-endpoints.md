---
title: REST Endpoints
---

The self-hosted server (`openeye serve <model>`) runs on port 8000 by default and exposes the following REST endpoints. The Agent, Governance, and MLOps sections document the /agent, /governance, and /mlops routes on the same server.

### CORS

By default the server accepts browser requests from https://openeye.sh, https://www.openeye.sh, http://localhost:5173, http://localhost:3000, and http://localhost:8080, and answers Chrome's Private Network Access preflight. That is what lets the openeye.sh dashboard talk to a server on your machine. Set CORS_ORIGINS to a comma-separated list to replace the defaults.

### GET /

A built-in browser page for trying the server.

### GET /health

Health check endpoint.

```json
{
  "status": "ok",
  "model": "yolov8",
  "model_display_name": "YOLOv8",
  "task": "detection",
  "model_loaded": true,
  "uptime_seconds": 123.4,
  "queue": { "active": 0, "queued": 0 }
}
```

### POST /predict

Run inference on an uploaded image. Request: multipart form with a `file` field (max 20 MB). Rate limited to 30 requests per minute per client IP.

| Parameter | In | Default | Description |
|-----------|----|---------|-------------|
| prompt | query | null | Text prompt for open-vocabulary models (e.g. grounding-dino) |

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

### POST /perception

Runs one image through the full perception pipeline (scene graph, spatial relationships, safety zones) and returns a PerceptionFrame, the same shape as the /ws/perception stream.

### POST /vlm/analyze

Sends an uploaded image to the configured VLM (needs OPENROUTER_API_KEY or NEBIUS_API_KEY) and returns structured JSON. An optional `prompt` query parameter replaces the default visual bug-detection prompt.

### GET /config & PUT /config

Get or replace the runtime configuration. PUT takes a JSON object and replaces the whole config with it, so send every field you want to keep. From the CLI: `openeye server-config-get` and `openeye server-config-set <key> <value>`.

### GET /metrics

Prometheus-format metrics endpoint. Returns counters and histograms for request counts, latencies, and inference times.

### GET /queue/status

Inference queue status. The queue runs one inference at a time and holds up to 16 waiting requests; beyond that, requests get 503.

```json
{"status": "idle", "active": 0, "queued": 0, "max_queue_size": 16, "capacity_percent": 0.0}
```

`status` is one of idle, processing, busy (queue over half full), or overloaded.

### GET /nebius/stats

Nebius Token Factory VLM usage statistics (also `openeye nebius-stats`).

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

### /v1 routes

The server also mounts the hosted API's routes so `openeye api --server http://localhost:8000` and hosted-API client code can point at it:

| Method | Path | Notes |
|--------|------|-------|
| POST | /v1/detect | Runs the served model; `confidence` is a query parameter (default 0.25) |
| POST | /v1/depth | Runs the served model; use `openeye serve depth-anything` |
| POST | /v1/describe | Uses the served model's prompt support; `prompt` is a query parameter |
| GET | /v1/models | Lists the one model being served |
| GET | /v1/usage | Calls and credits counted for your key since the server started |

Differences from the hosted API at https://openeye.sh/v1:

- Auth is `Authorization: Bearer <key>` only (no X-API-Key). Any key starting with oe_ is accepted; set OPENEYE_SERVER_API_KEY to accept only that exact key.
- Credits are counted in memory (detect 1, depth 2, describe 5, from a notional 1,000) and reset on restart. Nothing is charged.
- Uploads up to 20 MB; errors use FastAPI's `{"detail": "..."}` body.

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Cannot decode image (on /v1 routes, also empty or oversized files) |
| 401 | Missing or invalid Bearer key (/v1 routes) |
| 413 | File too large (over 20 MB) |
| 429 | Rate limit exceeded (30 requests/minute on /predict) |
| 500 | Inference failed |
| 503 | Server busy (queue full), or VLM / perception pipeline not configured |

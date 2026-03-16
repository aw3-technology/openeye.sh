# Server API Reference

The OpenEye server (`openeye serve`) exposes REST and WebSocket endpoints on port 8000 by default.

## REST Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "model": "yolov8",
  "model_loaded": true,
  "uptime_seconds": 123.4
}
```

### `POST /predict`

Run inference on an uploaded image. Rate-limited.

**Request:** Multipart form with `file` field (JPEG/PNG, max 20MB).

**Query Parameters:**

- `prompt` (optional) — Text prompt for open-vocabulary models

**Response:**
```json
{
  "model": "yolov8",
  "task": "detection",
  "timestamp": "2026-01-15T10:30:00Z",
  "image": {"width": 640, "height": 480, "source": "upload.jpg"},
  "objects": [
    {"label": "person", "confidence": 0.95, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}
  ],
  "depth_map": null,
  "segmentation_masks": null,
  "vla_action": null,
  "inference_ms": 12.3
}
```

**Error Responses:**

- `400` — Cannot decode image
- `413` — File too large
- `429` — Rate limit exceeded (30 requests/minute per IP)
- `500` — Inference failed
- `503` — Server busy (queue full)

### `GET /config`

Get current runtime configuration (VLM model, cortex LLM, governance settings).

### `PUT /config`

Update runtime configuration. Body: JSON object with keys to update.

### `GET /nebius/stats`

Get VLM (Nebius Token Factory) usage statistics.

**Response:**
```json
{
  "total_calls": 42,
  "total_tokens_estimated": 12500,
  "total_latency_ms": 8400.0,
  "avg_latency_ms": 200.0,
  "errors": 1,
  "last_call_at": 1710500000.0,
  "model": "Qwen/Qwen2.5-VL-72B-Instruct",
  "provider": "Nebius Token Factory",
  "configured": true,
  "uptime_seconds": 3600.0
}
```

### `GET /metrics`

Prometheus metrics endpoint. Exposes request counts, latency histograms, active WebSocket connections, and model info.

### `GET /queue/status`

Inference queue status (pending items, capacity).

### `GET /`

Browser dashboard (HTML). Provides a built-in web UI for testing inference.

## WebSocket Endpoints

### `ws://host:port/ws`

Basic real-time inference over WebSocket.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON prediction result (same schema as `/predict`).

**Error:** `{"error": "description"}` if inference fails.

### `ws://host:port/ws/perception`

Full perception pipeline with scene graph generation, object tracking, safety evaluation, and change detection.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON with detections, scene graph, spatial relationships, safety zones, and alerts.

### `ws://host:port/ws/vlm`

VLM (Vision Language Model) reasoning on camera frames. Sends frames to a configured VLM provider (Nebius or OpenRouter) and returns natural language scene descriptions.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON with VLM description, latency, and token usage.

Requires `NEBIUS_API_KEY` or `OPENROUTER_API_KEY` environment variable, or a `--vlm-model` flag with an `openrouter/` prefix.

### `ws://host:port/ws/agentic`

Continuous agentic loop combining detection, scene understanding, VLM reasoning, and action planning.

**Send:** JSON with `frame` (base64 image) and optional `goal` or `set_goal` fields.

**Receive:** JSON with detections, scene graph, scene description, VLM reasoning, action plan, safety zones/alerts, memory changes, and timeline events.

This endpoint maintains persistent object memory and a timeline of events across frames, enabling goal-directed autonomous behavior.

## Agent Endpoints

REST endpoints for controlling the agentic perception loop, prefixed with `/agent`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /agent/start | Start the agentic loop (body: `{"goal": "..."}`) |
| POST | /agent/stop | Stop the agentic loop |
| GET | /agent/status | Get agent status (running, tick count, plan, goal) |
| GET | /agent/stream | SSE stream of AgentTickEvent objects |
| GET | /agent/memory | Get recent observations (query param: `limit`) |
| POST | /agent/recall | Query observation memory (RecallQuery body) |
| GET | /agent/demo/stream | Scripted demo data SSE stream for frontend dev |

## Governance Endpoints

Optional endpoints for safety policy management, prefixed with `/governance`. Returns 503 if the governance engine is not initialized.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /governance/status | Engine status |
| GET | /governance/policies | List active policies |
| GET | /governance/policies/available | List available policy types |
| POST | /governance/policies/{name}/enable | Enable a policy |
| POST | /governance/policies/{name}/disable | Disable a policy |
| GET | /governance/presets | List governance presets |
| POST | /governance/presets/{name}/load | Load a preset |
| GET | /governance/config | Get config (YAML) |
| PUT | /governance/config | Update config (body: `{"yaml": "..."}`) |
| GET | /governance/audit | Audit log (params: `limit`, `offset`) |
| GET | /governance/violations | Policy violations (param: `limit`) |

## MLOps Endpoints

Model lifecycle management endpoints under `/mlops`. Covers model registry, stage promotion, A/B testing, retraining pipelines, batch inference, benchmarks, validation, lineage, export, shadow deployments, and feedback annotations. See the MLOps API section in the frontend docs for the full endpoint reference.

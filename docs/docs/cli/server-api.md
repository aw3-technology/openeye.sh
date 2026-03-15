# Server API Reference

The OpenEye server (`openeye serve <model>`) exposes REST and WebSocket endpoints on port 8000 (default).

## REST Endpoints

### `GET /health`

Health check endpoint with model status and uptime.

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

Run inference on an uploaded image.

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
  "inference_ms": 12.3
}
```

**Error Responses:**

- `400` — Cannot decode image
- `413` — File too large
- `500` — Inference failed
- `503` — Server busy (queue full), includes `Retry-After: 5` header

### `GET /config`

Get current runtime configuration.

### `PUT /config`

Update runtime configuration. Body: JSON object.

### `GET /`

Browser dashboard (HTML).

### `GET /metrics`

Prometheus metrics endpoint.

### `GET /queue/status`

Inference queue depth and status.

### `GET /nebius/stats`

Nebius Token Factory VLM usage statistics (latency, token counts, error count, uptime).

## Debug REST Endpoints

### `POST /debug/analyze`

Analyze a screenshot for UI issues using VLM. Upload via `file` field (multipart, max 20MB). Returns a `DebugAnalysis` JSON object.

### `POST /debug/diff`

Compare before/after screenshots for visual regressions. Upload via `before` and `after` fields (multipart). Returns VLM diff analysis with optional pixel diff percentage and SSIM score (when scikit-image is installed).

## WebSocket Endpoints

### `WS /ws`

Real-time inference over WebSocket.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON prediction result (same schema as `/predict`).

**Error:** `{"error": "description"}` if inference fails.

### `WS /ws/perception`

Full perception pipeline with scene graph generation.

Processes frames through YOLO detection and scene graph analysis. Falls back to basic detection if the perception pipeline is unavailable.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON with normalized bounding boxes and scene analysis.

### `WS /ws/vlm`

VLM (Vision Language Model) reasoning endpoint.

Sends frames to a configured VLM provider (Nebius, OpenRouter, or custom) for visual reasoning about safety hazards and scene understanding.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON with VLM reasoning, safety analysis, and recommendations.

Requires `NEBIUS_API_KEY` environment variable (or another configured VLM provider).

### `WS /ws/agentic`

Continuous perception + reasoning + planning loop.

**Send:**
```json
{
  "frame": "<base64-encoded image>",
  "goal": "current goal text",
  "set_goal": "optional new goal to set"
}
```

**Receive:** Comprehensive frame analysis:
```json
{
  "type": "agentic_frame",
  "frame_id": 42,
  "goal": "monitor the scene",
  "detections": [...],
  "scene_graph": {"nodes": [...], "relationships": [...], "root_id": "scene"},
  "scene_description": "...",
  "vlm_reasoning": {"description": "...", "reasoning": "...", "latency_ms": 1200},
  "action_plan": [...],
  "safety_zones": [...],
  "safety_alerts": [...],
  "change_alerts": [...],
  "memory": {
    "objects_seen": {"track_id": {"label": "person", "frames_seen": 10, "seconds_tracked": 5.2}},
    "timeline": [...],
    "frame_count": 42,
    "total_objects_tracked": 5
  },
  "latency": {
    "detection_ms": 15.2,
    "vlm_ms": 1200.0,
    "total_ms": 1250.3
  }
}
```

Features:

- Memory tracking across frames (2-3s disappearance threshold)
- Timeline events (max 50 entries)
- Goal-based action planning
- Real-time object tracking with track IDs
- VLM reasoning throttled to every 3 seconds

### `WS /ws/desktop`

Desktop vision: detect UI elements and analyze screen layout using VLM.

**Send:**
```json
{"frame": "<base64>", "query": "optional element search"}
```

**Receive:** `desktop_frame` result with detected objects, active window info, UI elements, text regions, and layout description. When a `query` is provided, response type changes to `desktop_find` with `found`, `query`, and `alternatives` fields. Supports `"ping"` / `"pong"` keepalive.

### `WS /ws/debug`

Live UI debug stream for visual inspection.

**Send:** Base64-encoded frame (or `"ping"` for keepalive).

**Receive:** `DebugAnalysis` JSON with issue detection summary, tracked across consecutive frames for change context.

## Agent REST API (prefix `/agent`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/agent/start` | Start agentic loop with `{"goal": "..."}`. Returns 409 if already running. |
| `POST` | `/agent/stop` | Stop agentic loop. Returns tick count. |
| `GET` | `/agent/status` | Get agent status: `{running, tick_count, current_plan, goal}` |
| `GET` | `/agent/stream` | SSE stream of `AgentTickEvent` objects. Emits `{"done": true}` on stop. |
| `GET` | `/agent/memory` | Get recent observations (query param: `limit`, default 20). |
| `POST` | `/agent/recall` | Query observation memory with `RecallQuery` body. Returns `RecallResult`. |
| `GET` | `/agent/demo/stream` | SSE stream of a scripted 10-tick demo scenario (no backend needed). |

## MLOps API (prefix `/mlops`)

All MLOps endpoints are mounted under `/mlops`:

- **Models** (`/mlops/models/*`) — Model upload, registry listing, versioning
- **Lifecycle** (`/mlops/models/{key}/promote/*`, `/mlops/promotions`, `/mlops/ab-tests/*`) — Stage promotion with approval workflow, A/B testing
- **Pipelines** (`/mlops/retraining/*`, `/mlops/batch-inference/*`) — Retraining pipelines with trigger support, batch inference jobs
- **Evaluation** (`/mlops/benchmarks/*`, `/mlops/validation-tests/*`, `/mlops/validation-runs`) — Model benchmarks, validation test suites
- **Deployment** (`/mlops/lineage/*`, `/mlops/export*`, `/mlops/shadow-deployments/*`) — Model lineage tracking, ONNX/TensorRT/CoreML export, shadow deployments
- **Feedback** (`/mlops/annotations`, `/mlops/feedback-batches`) — Inference failure annotations, feedback batch execution

## Governance API (prefix `/govern`)

Conditionally available when the `governance` package is installed. Provides policy definition, violation detection, and audit trail endpoints. The router is imported at app startup and skipped if the package is not found.

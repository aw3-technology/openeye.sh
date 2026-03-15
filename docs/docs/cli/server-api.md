# Server API Reference

The OpenEye server (`openeye serve`) exposes REST and WebSocket endpoints.

## REST Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{"status": "ok", "model": "yolov8"}
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

### `GET /config`

Get current runtime configuration.

### `PUT /config`

Update runtime configuration. Body: JSON object.

### `GET /`

Browser dashboard (HTML).

## WebSocket

### `ws://host:port/ws`

Real-time inference over WebSocket.

**Send:** Base64-encoded image as text frame.

**Receive:** JSON prediction result (same schema as `/predict`).

**Error:** `{"error": "description"}` if inference fails.

### `GET /metrics`

Prometheus metrics endpoint (when metrics are enabled).

### `GET /queue/status`

Inference queue status (when rate limiting is enabled).

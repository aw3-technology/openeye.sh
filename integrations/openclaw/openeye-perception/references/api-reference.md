# OpenEye Hosted API Reference

Base URL: `https://api.openeye.ai` (configurable via `OPENEYE_API_URL`)

## Authentication

All inference and usage endpoints accept an API key via either header:

- `X-API-Key: oe_xxx`
- `Authorization: Bearer oe_xxx`

Fleet management endpoints require a JWT:

- `Authorization: Bearer <jwt>`

## Rate Limiting

Default: 120 requests per 60-second sliding window (per API key).

Response headers on every request:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

## Endpoints

### POST /v1/detect

Object detection using YOLOv8.

**Request**: `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | Image file (JPEG, PNG, WebP). Max 20 MB |
| `confidence` | float | 0.25 | Minimum confidence threshold (0.0–1.0) |

**Cost**: 1 credit

### POST /v1/depth

Depth estimation using Depth Anything V2.

**Request**: `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | Image file. Max 20 MB |

**Cost**: 2 credits

### POST /v1/describe

Scene description using GPT-4o vision.

**Request**: `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | Image file. Max 20 MB |
| `prompt` | string | "Describe what you see in this image." | Vision prompt. Max 2000 chars |

**Cost**: 3 credits

### GET /v1/models

List available models and their credit costs.

**Response**: Array of `ModelInfo` objects.

### GET /v1/usage

Credit balance and usage statistics.

| Param | Type | Default | Description |
|---|---|---|---|
| `days` | int | 30 | Usage history window (1–365) |

### WS /v1/stream

Real-time streaming inference over WebSocket.

**Protocol**:
1. Client connects to `wss://api.openeye.ai/v1/stream`
2. Client sends auth: `{"api_key": "oe_xxx"}`
3. Server responds: `{"status": "authenticated"}`
4. Client optionally sends config: `{"model": "yolov8", "confidence": 0.3}`
5. Client sends base64-encoded image frames as text messages
6. Server responds with detection JSON for each frame

**Cost**: 1 credit per frame

### GET /devices

List fleet devices. Requires JWT auth.

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter: pending, online, offline, maintenance, error, decommissioned |
| `device_type` | string | Filter: camera, robot, edge_node, gateway, drone |

### GET /devices/{device_id}

Get a single device by ID. Requires JWT auth.

### GET /alerts

List fleet alerts. Requires JWT auth.

| Param | Type | Description |
|---|---|---|
| `severity` | string | Filter: info, warning, error, critical |
| `resolved` | bool | Filter by resolution status |

## Error Responses

All errors return JSON with a `detail` field:

| Status | Meaning |
|---|---|
| 400 | Bad request (invalid image, prompt too long) |
| 401 | Invalid or missing API key |
| 402 | Insufficient credits |
| 413 | File too large (>20 MB) |
| 429 | Rate limit exceeded |
| 5xx | Server error |

# OpenEye Hosted API Reference

Base URL: `https://api.openeye.ai` (configurable via `OPENEYE_API_URL`)

## Authentication

All inference and usage endpoints accept an API key via either header:

- `X-API-Key: oe_xxx`
- `Authorization: Bearer oe_xxx`

Fleet management endpoints require a JWT:

- `Authorization: Bearer <jwt>`

Device heartbeat endpoints use device API keys:

- `X-Device-API-Key: dev_xxx`

## Rate Limiting

Default: 120 requests per 60-second sliding window (per API key, configurable).

Response headers on every request:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

## Inference Endpoints

### POST /v1/detect

Object detection using YOLOv8.

**Request**: `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | Image file (JPEG, PNG, WebP). Max 20 MB |
| `confidence` | float | 0.25 | Minimum confidence threshold (0.0-1.0) |

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
| `days` | int | 30 | Usage history window (1-365) |

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

## Fleet Management Endpoints

Fleet endpoints run on port 8001.

### Devices

| Method | Endpoint | Description |
|---|---|---|
| POST | /devices | Register a new device |
| GET | /devices | List devices (filter by `status`, `device_type`, `tag_key`, `tag_value`) |
| GET | /devices/{id} | Get device details |
| PATCH | /devices/{id} | Update device |
| PUT | /devices/{id}/tags | Set device tags |
| PUT | /devices/{id}/config | Set config overrides |
| GET | /devices/{id}/resources | Get resource usage history |
| POST | /devices/{id}/restart | Restart device |
| DELETE | /devices/{id} | Decommission device |
| POST | /devices/batch | Batch operation on multiple devices |

### Heartbeats

| Method | Endpoint | Description |
|---|---|---|
| POST | /heartbeats | Receive device heartbeat (returns pending commands) |

### Deployments

| Method | Endpoint | Description |
|---|---|---|
| POST | /deployments | Create deployment |
| GET | /deployments | List deployments (filter by `status`) |
| GET | /deployments/{id} | Get deployment details |
| GET | /deployments/{id}/devices | Get device statuses for deployment |
| POST | /deployments/{id}/advance | Advance deployment stage |
| POST | /deployments/{id}/pause | Pause deployment |
| POST | /deployments/{id}/rollback | Rollback deployment |

### Device Groups

| Method | Endpoint | Description |
|---|---|---|
| POST | /groups | Create device group |
| GET | /groups | List device groups |
| GET | /groups/{id} | Get group details |
| DELETE | /groups/{id} | Delete group |
| POST | /groups/{id}/members | Add device to group |
| DELETE | /groups/{id}/members/{device_id} | Remove device from group |
| GET | /groups/{id}/members | List group members |
| PUT | /groups/{id}/scaling | Set auto-scaling policy |

### Maintenance

| Method | Endpoint | Description |
|---|---|---|
| POST | /maintenance | Create maintenance window |
| GET | /maintenance | List maintenance windows (filter by `active_only`) |
| GET | /maintenance/{id} | Get maintenance window |
| PATCH | /maintenance/{id} | Update maintenance window |
| DELETE | /maintenance/{id} | Delete maintenance window |

### Alerts

| Method | Endpoint | Description |
|---|---|---|
| GET | /alerts | List alerts (filter by `severity`, `resolved`) |
| POST | /alerts/{id}/resolve | Resolve alert |

### OTA Updates

| Method | Endpoint | Description |
|---|---|---|
| POST | /ota/update | Push OTA firmware update |

### Commands

| Method | Endpoint | Description |
|---|---|---|
| GET | /commands | List commands (filter by `device_id`, `status`) |
| POST | /commands/{id}/complete | Complete command |
| POST | /commands/{id}/device-complete | Device completes command (device API key auth) |

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

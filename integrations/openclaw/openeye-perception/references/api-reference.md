# OpenEye API Reference

Base URL: `https://openeye.sh` (configurable via `OPENEYE_API_URL`). All inference endpoints are under `/v1`.

The same `/v1` contract is also served by a local `openeye serve <model>` (`http://localhost:8000`) and by a self-hosted fleet control plane (`http://localhost:8001`); differences are noted below.

## Authentication

Inference and usage endpoints accept an API key via either header:

- `Authorization: Bearer oe_xxx`
- `X-API-Key: oe_xxx`

Create keys at https://openeye.sh/dashboard/settings/api-keys. A key is shown once; only its SHA-256 hash is stored.

## Rate Limiting (hosted)

Default 60 requests per 60-second window per API key (set per key). Headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `Retry-After` | Seconds to wait (on 429) |

## Inference Endpoints

### POST /v1/detect

Object detection with YOLOv8n (80 COCO classes), CPU.

**Request**: `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | JPEG or PNG, under 4 MB, at most 25 megapixels |
| `confidence` | float | 0.25 | Minimum confidence (0.0-1.0). Form field or query parameter |

**Cost**: 1 credit

### POST /v1/describe

Scene description with a vision-language model (hosted: Qwen2.5-VL via OpenRouter).

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | (required) | JPEG or PNG, under 4 MB |
| `prompt` | string | "Describe what you see in this image." | Max 2000 characters |

**Cost**: 3 credits. **Hosted status**: returns 503 until the VLM is enabled; `GET /v1/models` shows `available: true` for `qwen2.5-vl` when it is.

### POST /v1/depth

Depth estimation with Depth Anything V2.

**Hosted status**: always 501. Run `openeye serve depth-anything` and call `http://localhost:8000/v1/depth` instead. **Cost** (where available): 2 credits.

### GET /v1/models

Array of `{ id, name, task, credits_per_call, description, available }`.

### GET /v1/usage

Balance and usage statistics for the key's owner.

| Param | Type | Default | Description |
|---|---|---|---|
| `days` | int | 30 | Usage window (1-365) |

### Streaming

There is no WebSocket streaming on the hosted API. A self-hosted fleet control plane offers `WS /v1/stream` (first message `{"api_key": "oe_xxx"}`, then base64 frames; 1 credit per frame), and `openeye serve` offers `ws://localhost:8000/ws`.

## Credits

Credits are bought at https://openeye.sh/dashboard/settings/credits. They are deducted before inference and refunded if inference fails. Users who have never bought credits get 402.

## Error Responses

Hosted errors are JSON `{ "error": "<message>" }` (self-hosted FastAPI servers use `{ "detail": "<message>" }`).

| Status | Meaning |
|---|---|
| 400 | Bad request (missing `file`, bad `confidence`, undecodable image, prompt too long) |
| 401 | Invalid or missing API key |
| 402 | Not enough credits |
| 404 | Unknown endpoint |
| 413 | Image too large (hosted: 4 MB / 25 MP; fleet control plane: 20 MB) |
| 415 | Not multipart, or not JPEG/PNG |
| 429 | Rate limit exceeded |
| 501 | Depth on the hosted API |
| 502 | Upstream vision model failed |
| 503 | Describe not enabled on the hosted API |

## Fleet Management Endpoints (self-hosted)

The fleet control plane (`backend/src/fleet`) runs wherever the user deploys it, usually `http://localhost:8001`. It is not available at openeye.sh. Auth: `Authorization: Bearer <OpenEye session token>` (or an `oe_` key); devices use `X-Device-API-Key: oek_xxx`.

### Devices

| Method | Endpoint | Description |
|---|---|---|
| POST | /devices | Register a new device |
| GET | /devices | List devices (filter by `status`, `device_type`, `tag_key`, `tag_value`) |
| GET | /devices/{id} | Get device details |
| PATCH | /devices/{id} | Update device |
| PUT | /devices/{id}/tags | Set device tags |
| PUT | /devices/{id}/config | Set config overrides |
| GET | /devices/{id}/resources | Resource usage history |
| POST | /devices/{id}/restart | Restart device |
| DELETE | /devices/{id} | Decommission device |
| POST | /devices/batch | Batch operation on tagged devices |

### Heartbeats and Commands

| Method | Endpoint | Description |
|---|---|---|
| POST | /heartbeats | Device heartbeat (returns pending commands; device key) |
| GET | /commands | List commands (filter by `device_id`, `status`) |
| POST | /commands/{id}/complete | Complete command |
| POST | /commands/{id}/device-complete | Device completes command (device key) |

### Deployments

| Method | Endpoint | Description |
|---|---|---|
| POST | /deployments | Create deployment |
| GET | /deployments | List deployments (filter by `status`) |
| GET | /deployments/{id} | Get deployment |
| GET | /deployments/{id}/devices | Device statuses for a deployment |
| POST | /deployments/{id}/advance | Advance stage |
| POST | /deployments/{id}/pause | Pause |
| POST | /deployments/{id}/rollback | Roll back |

### Device Groups

| Method | Endpoint | Description |
|---|---|---|
| POST | /groups | Create group |
| GET | /groups | List groups |
| GET | /groups/{id} | Get group |
| DELETE | /groups/{id} | Delete group |
| POST | /groups/{id}/members | Add device |
| DELETE | /groups/{id}/members/{device_id} | Remove device |
| GET | /groups/{id}/members | List members |
| PUT | /groups/{id}/scaling | Set auto-scaling policy |

### Maintenance, Alerts, OTA

| Method | Endpoint | Description |
|---|---|---|
| POST | /maintenance | Create maintenance window |
| GET | /maintenance | List windows (`active_only`) |
| GET / PATCH / DELETE | /maintenance/{id} | Get / update / delete window |
| GET | /alerts | List alerts (`severity`, `resolved`) |
| POST | /alerts/{id}/resolve | Resolve alert |
| POST | /ota/update | Push OTA update |
| GET | /health | Control-plane health |

---
name: openeye-perception
description: Call the OpenEye hosted inference API (https://openeye.sh/v1) for object detection, check credits and list models, or query a self-hosted OpenEye fleet. Use when the user asks about detecting objects in images, describing scenes, checking API credits, listing vision models, or querying a device fleet. Triggers on phrases like "detect objects", "what's in this image", "describe scene", "check credits", "list models", "fleet devices", "device alerts", "perception API", "vision API".
version: 0.2.0
env:
  OPENEYE_API_KEY:
    required: true
    description: API key starting with oe_, created at https://openeye.sh/dashboard/settings/api-keys
  OPENEYE_API_URL:
    required: false
    description: Base URL for the API (default https://openeye.sh; use http://localhost:8000 for a local `openeye serve`)
  OPENEYE_FLEET_URL:
    required: false
    description: Self-hosted fleet control plane URL (default http://localhost:8001)
  OPENEYE_FLEET_TOKEN:
    required: false
    description: OpenEye (Better Auth) session token for the fleet control plane
bins:
  - python3
---

# OpenEye Hosted Perception API

Call OpenEye's hosted inference API at `https://openeye.sh/v1` — no local GPU, model downloads, or ML libraries. Needs an API key, credits, and `python3` with `requests`.

The user gets a key at https://openeye.sh/dashboard/settings/api-keys and buys credits at https://openeye.sh/dashboard/settings/credits.

## Quick Start

```bash
export OPENEYE_API_KEY="oe_..."
python3 scripts/usage.py models      # what's available right now
python3 scripts/detect.py photo.jpg
```

If the OpenEye CLI is installed, the same calls are `openeye api models`, `openeye api detect photo.jpg`, and `openeye api usage`. With plain curl:

```bash
curl -s https://openeye.sh/v1/detect -H "Authorization: Bearer $OPENEYE_API_KEY" -F file=@photo.jpg
```

## Commands

### Detect Objects (1 credit)

```bash
python3 scripts/detect.py <image> [--confidence 0.3]
```

YOLOv8 (80 COCO classes). Returns JSON with `objects` (each has `label`, `confidence`, normalized `bbox {x,y,w,h}`), `image` dimensions, `inference_ms`, `credits_used`.

### Describe Scene (3 credits — not enabled on hosted yet)

```bash
python3 scripts/describe.py <image> [--prompt "How many people are visible?"]
```

Vision-language model (Qwen2.5-VL). The hosted API currently answers **503** ("isn't enabled yet"); check `usage.py models` — the `qwen2.5-vl` entry has `available: true` once it is. Works against a local `openeye serve` (set `OPENEYE_API_URL=http://localhost:8000`) when that server has a VLM key configured.

### Estimate Depth (self-hosted only)

```bash
python3 scripts/depth.py <image> [--save-depth-map out.png]
```

The hosted API returns **501** for depth. To get depth, run `openeye serve depth-anything` locally and set `OPENEYE_API_URL=http://localhost:8000`.

### Check Usage & Models

```bash
python3 scripts/usage.py balance [--days 30]   # balance + usage stats
python3 scripts/usage.py models                 # models, credit costs, availability
```

### Query Fleet (self-hosted control plane)

The fleet control plane is not hosted at openeye.sh. Use this only if the user runs one; set `OPENEYE_FLEET_URL` (default `http://localhost:8001`) and `OPENEYE_FLEET_TOKEN`.

```bash
python3 scripts/fleet_query.py list [--status online] [--type camera]
python3 scripts/fleet_query.py get <device-id>
python3 scripts/fleet_query.py alerts [--severity critical] [--unresolved]
```

## Limits and costs

| Endpoint | Credits | Hosted status |
|---|---|---|
| `POST /v1/detect` | 1 | live |
| `POST /v1/describe` | 3 | 503 until enabled |
| `POST /v1/depth` | 2 | 501 (self-hosted only) |
| `GET /v1/models`, `GET /v1/usage` | 0 | live |

- Images: JPEG or PNG, under 4 MB.
- Rate limit: 60 requests/minute per key by default.
- No WebSocket streaming on the hosted API.

## Error Handling

Scripts print JSON to stdout on success and `{"error": "..."}` to stderr on failure. Exit codes:

| Exit Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Client error (bad args, missing env, file not found, 413 too large, 415 not JPEG/PNG) |
| 2 | Auth error (401 — invalid API key) |
| 3 | Payment error (402 — not enough credits) |
| 4 | Rate limit (429 — wait and retry) |
| 5 | Server error (5xx, including 501 depth and 503 describe on hosted) |

## Guardrails

- **Check credits first** — run `usage.py balance` before batch inference; warn if low.
- **Handle 402/429** — tell the user and stop; for 402 point them to the credits page.
- **Never log keys** — do not echo `OPENEYE_API_KEY` or `OPENEYE_FLEET_TOKEN`.
- **Prompt length** — max 2000 characters for describe prompts.

## References

- `references/api-reference.md` — endpoint documentation
- `references/response-schemas.md` — example JSON responses

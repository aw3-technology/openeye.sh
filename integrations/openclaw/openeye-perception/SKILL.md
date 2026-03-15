---
name: openeye-perception
description: Call the OpenEye Hosted Inference API for object detection, depth estimation, and scene description. Use when the user asks about detecting objects in images, estimating depth, describing scenes, checking API credits, listing vision models, or querying a device fleet. Triggers on phrases like "detect objects", "what's in this image", "depth map", "describe scene", "check credits", "list models", "fleet devices", "device alerts", "perception API", "vision API".
version: 0.1.0
env:
  OPENEYE_API_KEY:
    required: true
    description: API key starting with oe_ from the OpenEye dashboard
  OPENEYE_API_URL:
    required: false
    description: Base URL for the hosted API (default https://api.openeye.ai)
  OPENEYE_FLEET_TOKEN:
    required: false
    description: JWT token for fleet management endpoints
bins:
  - python3
---

# OpenEye Hosted Perception API

Call OpenEye's cloud inference API — no local GPU, model downloads, or Python ML libraries needed. Just an API key and `python3` with `requests`.

## Quick Start

```bash
export OPENEYE_API_KEY="oe_..."
python3 scripts/detect.py photo.jpg
```

## Commands

### Detect Objects

```bash
python3 scripts/detect.py <image> [--confidence 0.3]
```

Runs YOLOv8 object detection. Returns JSON with `objects` array (each has `label`, `confidence`, `bbox`), `image` dimensions, and `inference_ms`.

### Estimate Depth

```bash
python3 scripts/depth.py <image> [--save-depth-map out.png]
```

Runs Depth Anything V2. Returns JSON with `depth_map` (base64 PNG), `image` dimensions, and `inference_ms`. Use `--save-depth-map` to write the depth map to a file (base64 is truncated in stdout when this flag is used).

### Describe Scene

```bash
python3 scripts/describe.py <image> [--prompt "How many people are visible?"]
```

Runs GPT-4o vision. Returns JSON with `description` (natural language), `image` dimensions, and `inference_ms`. Default prompt: "Describe what you see in this image."

### Check Usage & Models

```bash
python3 scripts/usage.py balance [--days 30]   # credit balance + usage stats
python3 scripts/usage.py models                 # list available models + costs
```

### Query Fleet

Requires `OPENEYE_FLEET_TOKEN` environment variable (JWT).

```bash
python3 scripts/fleet_query.py list [--status online] [--type camera]
python3 scripts/fleet_query.py get <device-id>
python3 scripts/fleet_query.py alerts [--severity critical] [--unresolved]
```

## Credit Costs

| Endpoint | Credits |
|---|---|
| `/v1/detect` | 1 |
| `/v1/depth` | 2 |
| `/v1/describe` | 3 |
| `/v1/stream` (per frame) | 1 |

Always check the user's balance with `usage.py balance` before running multiple inference calls. If the balance is low, warn the user.

## Error Handling

All scripts output structured JSON to stdout on success and structured JSON to stderr on failure. Exit codes:

| Exit Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Client error (bad args, missing env, file not found) |
| 2 | Auth error (401 — invalid API key) |
| 3 | Payment error (402 — insufficient credits) |
| 4 | Rate limit (429 — try again later) |
| 5 | Server error (5xx) |

## Guardrails

- **Check credits first** — run `usage.py balance` before batch inference.
- **Handle 402/429** — if credits are low or rate-limited, tell the user and stop.
- **Never log API keys** — do not echo `OPENEYE_API_KEY` or `OPENEYE_FLEET_TOKEN` in output.
- **Image size limit** — max 20 MB per image upload.
- **Prompt length** — max 2000 characters for describe prompts.

## References

- `references/api-reference.md` — full endpoint documentation
- `references/response-schemas.md` — example JSON responses

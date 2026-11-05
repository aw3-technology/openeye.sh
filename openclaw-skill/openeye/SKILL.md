---
name: openeye
description: Run computer vision inference, manage models, serve perception APIs, call the hosted OpenEye API, and manage edge device fleets using the OpenEye CLI. Use when working with object detection, depth estimation, camera feeds, model benchmarking, or robot/agent perception. Triggers on phrases like "detect objects", "run inference", "pull a vision model", "start perception server", "hosted vision API", "check OpenEye credits", "manage fleet", "deploy model to devices", "watch camera", "benchmark model", "run yolo", "depth estimation", "scene understanding", "safety zones", "custom adapter".
---

# OpenEye

OpenEye is an open-source CLI perception engine for robots and autonomous agents. It wraps vision models (YOLO, Depth Anything, Grounding DINO, SAM 2, RF-DETR, SmolVLA) behind one interface with tracking, 3D estimation, safety and fleet management. It runs two ways:

- **Self-hosted**: models run on this machine through `openeye run` / `openeye serve`. Free, works offline, supports every model.
- **Hosted API**: `https://openeye.sh/v1`, no GPU or model downloads. Needs an API key and credits; detection only for now.

Install: `pipx install "openeye-sh[all]"` (Python 3.12+). Add extras as needed, e.g. `pipx install "openeye-sh[yolo,camera]"`.
Config: `~/.openeye/config.yaml` · Models: `~/.openeye/models/`

## Choosing a path

| Situation | Use |
|---|---|
| No GPU / can't install ML deps / just need object detection | Hosted: `openeye api detect` or curl |
| Need depth, segmentation, open-vocab detection, video, or offline use | Self-hosted: `openeye run` / `openeye serve` |
| Batch of many images and the user pays per call | Self-hosted, or check credits first with `openeye api usage` |

## Hosted API (https://openeye.sh/v1)

The user creates a key at https://openeye.sh/dashboard/settings/api-keys and buys credits at https://openeye.sh/dashboard/settings/credits.

```bash
export OPENEYE_API_KEY="oe_..."            # never echo this value

openeye api models                         # models + credit costs + availability
openeye api detect photo.jpg --pretty      # YOLOv8 detection, 1 credit
openeye api detect photo.jpg -c 0.5        # higher confidence threshold
openeye api usage --days 7                 # balance and recent usage
```

Without the CLI:

```bash
curl -s https://openeye.sh/v1/detect \
  -H "Authorization: Bearer $OPENEYE_API_KEY" \
  -F file=@photo.jpg -F confidence=0.3 | jq '.objects'

curl -s "https://openeye.sh/v1/usage?days=30" -H "Authorization: Bearer $OPENEYE_API_KEY"
```

Facts to rely on:

- Images: JPEG or PNG, under 4 MB.
- `POST /v1/detect` costs 1 credit. `POST /v1/describe` (3 credits) currently returns 503: not enabled yet. `POST /v1/depth` returns 501 on hosted: use `openeye serve depth-anything` locally instead.
- Errors are JSON `{"error": "..."}`: 401 bad key, 402 out of credits (tell the user to buy credits), 413 image too large, 415 not JPEG/PNG, 429 rate limited (60/min per key by default; wait `Retry-After` seconds).
- `OPENEYE_API_URL` overrides the base URL (default `https://openeye.sh`); `openeye api ... --server http://localhost:8000` sends the same calls to a local `openeye serve`.

## Self-hosted: models

```bash
openeye list                              # available models + download status
openeye pull yolov8                       # download weights
openeye pull yolov8 --quantized           # INT8 ONNX variant
openeye pull grounding-dino               # open-vocabulary detection
openeye remove yolov8                     # delete weights (ask the user first)
openeye update-registry                   # refresh model catalog
```

Model keys: `yolov8`, `yolo26`, `rfdetr`, `grounding-dino`, `depth-anything`, `sam2`, `smolvla`.

## Self-hosted: inference

```bash
openeye run yolov8 photo.jpg --pretty                     # human-readable output
openeye run yolov8 photo.jpg -c 0.5                       # confidence threshold
openeye run yolov8 photo.jpg --visualize                  # also save an annotated image
openeye run depth-anything photo.jpg -o depth.json        # write JSON to a file
openeye run grounding-dino photo.jpg -p "red mug"         # open-vocab detection
openeye run yolov8 ./images/                              # a whole directory
openeye run yolov8 photo.jpg --backend onnx               # onnx or tensorrt backend
```

Default output is JSON (`model`, `task`, `image`, `objects[]` with `label`, `confidence`, normalized `bbox {x,y,w,h}`, `inference_ms`):

```bash
openeye run yolov8 photo.jpg | jq '.objects[] | select(.confidence > 0.8)'
```

## Live camera

```bash
openeye watch -m yolov8 -c 0                       # terminal UI with detections (needs [camera])
openeye watch -m yolov8,depth-anything -c 0 --demo # multi-model, pre-warmed
openeye watch -m yolov8 --video clip.mp4 --safety  # video file fallback + Safety Guardian overlay
```

## Serve over HTTP/WebSocket

```bash
openeye serve yolov8 --port 8000 --demo   # foreground; background it if you need the shell
openeye health                            # check it (uses OPENEYE_SERVER_URL, default http://localhost:8000)
```

Endpoints:

- `POST /predict` — multipart `file` → JSON detections
- `GET /health`, `GET /metrics`, `GET /queue/status`, `GET|PUT /config`
- `/v1/detect|depth|describe|models|usage` — same contract as the hosted API (any `oe_` key, or only `OPENEYE_SERVER_API_KEY` if set)
- WebSockets: `ws://host:port/ws`, `/ws/perception`, `/ws/agentic`, `/ws/vlm`
- `GET /` — built-in browser dashboard. The https://openeye.sh dashboard can also connect to this server (Server URL setting).

```bash
curl -s -X POST http://localhost:8000/predict -F "file=@photo.jpg" | jq .
```

## Benchmark

```bash
openeye bench yolov8 --runs 20 --warmup 5   # latency stats
```

## Custom models

```bash
openeye register-adapter my-model ./adapter.py --name "My Model" --task detection
openeye add-model my-model --name "My Model" --task detection --adapter my-model --hf-repo user/repo
openeye pull my-model && openeye run my-model photo.jpg
```

For writing custom adapters, see `references/custom-adapters.md`.

## Fleet Management

The fleet control plane is self-hosted (FastAPI on port 8001, Postgres). The CLI needs `OPENEYE_FLEET_URL` (default `http://localhost:8001`) and `OPENEYE_TOKEN` (the user's OpenEye session token). Devices can also be managed in the dashboard at https://openeye.sh/dashboard/fleet. Full reference: `references/fleet.md`.

```bash
openeye fleet register cam-01 --type camera
openeye fleet ls --status online
openeye fleet deploy --name yolo-v2-rollout --model yolov8 --version v2.1.0 --strategy canary
openeye fleet rollback <deployment-id>
openeye fleet config <device-id> '{"danger_zone_m": 0.5}'
openeye fleet agent --device-id <id> --api-key oek_...   # run on the device
```

Deployment strategies: `canary`, `rolling`, `blue_green`, `all_at_once`.

## Perception Pipeline

Multi-stage processing: detection -> depth -> tracking -> 3D -> scene graph -> safety -> change detection. See `references/perception-pipeline.md`.

- Object tracking with consistent IDs across frames
- 3D position estimation from 2D detections + depth
- Scene graphs with spatial relations (ON, UNDER, NEAR, LEFT_OF)
- Safety guardian with zone-based awareness and emergency halt
- Agent loop: `openeye agent run --goal "monitor the scene"`

## MCP

For MCP clients, the `openeye-mcp` server (install `openeye-sh[mcp]`) exposes the same local commands plus `openeye_api_detect`, `openeye_api_describe`, `openeye_api_models` and `openeye_api_usage`. Set `OPENEYE_API_KEY` in its environment for the hosted tools.

## Notes

- Python 3.12+. GPU optional (CPU fallback).
- Models download from Hugging Face on first pull; large ones take minutes.
- `openeye docs` prints the full CLI reference (`--json` for machines).
- Never print `OPENEYE_API_KEY`, `OPENEYE_TOKEN` or device keys.

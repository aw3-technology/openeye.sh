---
name: openeye
description: Run computer vision inference, manage models, serve perception APIs, and manage edge device fleets using the OpenEye CLI. Use when working with object detection, depth estimation, camera feeds, model benchmarking, or robot/agent perception. Triggers on phrases like "detect objects", "run inference", "pull a vision model", "start perception server", "manage fleet", "deploy model to devices", "watch camera", "benchmark model", "run yolo", "depth estimation", "scene understanding", "safety zones", "custom adapter".
---

# OpenEye

OpenEye is an open-source CLI perception engine for robots and autonomous agents. It wraps vision models (YOLO, Depth Anything, Grounding DINO) behind a unified interface with tracking, 3D estimation, safety, and fleet management.

Install: `pip install openeye-ai[all]`
Config: `~/.openeye/config.yaml`
Models: `~/.openeye/models/`

## Core Commands

### List and pull models

```bash
openeye list                              # show available models + download status
openeye pull yolov8                       # download model weights
openeye pull depth-anything --quantized   # pull quantized variant
openeye pull grounding-dino               # open-vocabulary detection
openeye remove yolov8                     # delete model weights
openeye update-registry                   # refresh model catalog
```

### Run inference

```bash
openeye run yolov8 photo.jpg --pretty                    # detect objects, pretty JSON
openeye run yolov8 photo.jpg --visualize                 # save annotated image
openeye run depth-anything photo.jpg --output depth.json  # depth estimation
openeye run grounding-dino photo.jpg --prompt "red mug"  # open-vocab detection
openeye run yolov8 photo.jpg --backend onnx              # use ONNX runtime
```

Output is structured JSON with `objects` (list of detections with label, confidence, bbox) and `inference_ms`. Pipe between commands:

```bash
openeye run yolov8 photo.jpg | jq '.objects[] | select(.confidence > 0.8)'
```

### Live camera

```bash
openeye watch --models yolov8 --camera 0              # terminal UI with detections
openeye watch --models yolov8,depth-anything --camera 0 --demo  # multi-model
```

### Serve over HTTP/WebSocket

```bash
openeye serve yolov8 --port 8000 --demo   # start server, pre-warm model
```

Endpoints:
- `POST /predict` — upload image, get JSON detections
- `GET /health` — server health
- `GET /config` / `PUT /config` — read/write config
- `ws://host:port/ws` — real-time WebSocket inference
- `GET /` — browser dashboard

```bash
curl -X POST http://localhost:8000/predict -F "file=@photo.jpg" | jq .
```

### Benchmark

```bash
openeye bench yolov8 --runs 20 --warmup 5   # outputs mean/median/p95 latency + FPS
```

### Configuration

```bash
openeye config get default_backend
openeye config set default_backend onnx
```

### Custom models

```bash
openeye register-adapter my-model ./adapter.py --name "My Model" --task detection
openeye add-model my-model --name "My Model" --task detection --adapter my-model --hf-repo user/repo
openeye pull my-model && openeye run my-model photo.jpg
```

For writing custom adapters, see `references/custom-adapters.md`.

## Fleet Management

Manage edge devices at scale. For full reference, see `references/fleet.md`.

```bash
openeye fleet register --name "cam-01" --type camera
openeye fleet ls --status online
openeye fleet deploy --name "yolo-v2-rollout" --model yolov8 --version v2.1.0 --strategy canary
openeye fleet rollback <deployment-id>
openeye fleet config <device-id> '{"danger_zone_m": 0.5}'
```

Deployment strategies: `canary`, `rolling`, `blue-green`, `all_at_once`.

## Perception Pipeline

Multi-stage processing: detection -> depth -> tracking -> 3D -> scene graph -> safety -> change detection. For architecture details, see `references/perception-pipeline.md`.

Key capabilities:
- **Object tracking** with consistent IDs across frames
- **3D position estimation** from 2D detections + depth
- **Scene graphs** with spatial relations (ON, UNDER, NEAR, LEFT_OF)
- **Safety guardian** with zone-based awareness and emergency halt
- **Natural language queries**: "Are there people near the shelf?"

## Notes

- Requires Python 3.10+. GPU optional (CPU fallback available).
- `ffmpeg` required on PATH for video/camera features.
- Models download from HuggingFace Hub on first pull.
- ONNX and TensorRT backends available for optimized inference.
- All commands output structured JSON suitable for piping.

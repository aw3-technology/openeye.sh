---
name: openeye
description: Get context-aware help with the OpenEye vision AI platform — CLI, server, fleet management, adapters, and frontend.
argument-hint: "<question about OpenEye>"
allowed-tools: Read, Glob, Grep, WebSearch, WebFetch, Agent
---

# OpenEye — Ollama for Vision AI

OpenEye is a full-stack vision AI platform. The CLI (`openeye`) lets you pull, run, serve, and manage computer-vision models from your terminal. The backend provides a perception pipeline with real-time object detection, depth estimation, scene understanding, and fleet management. The React frontend offers a dashboard for inference, live streaming, fleet control, and MLOps.

## Project Structure

```
cli/                          # Python CLI + inference server (Typer)
  openeye_ai/
    cli.py                    # Main CLI commands (1344 lines)
    fleet_cli.py              # Fleet management commands
    registry.py               # Model registry & adapter resolution
    config.py                 # User config (~/.openeye/config.yaml)
    schema.py                 # Pydantic output schemas
    models.yaml               # Bundled model registry
    adapters/                 # Model adapters (base.py, yolov8.py, depth_anything.py, etc.)
    mlops/                    # Model lifecycle (A/B testing, export, retraining, etc.)
    server/                   # FastAPI server (app.py, metrics.py, queue.py, rate_limit.py)
    utils/                    # Benchmark, camera, download, hardware, visualization
  tests/
  pyproject.toml              # Entry point: openeye = "openeye_ai.cli:app"

backend/                      # Perception runtime + fleet control plane
  src/
    run.py                    # Runtime entry point
    perception/               # Perception pipeline (detection, depth, tracking, scene graph)
    perception_grpc/          # gRPC streaming service (port 50051)
    fleet/                    # Fleet control plane (FastAPI, port 8001)
    runtime/                  # Mode system, cortex loop, mode manager
    inputs/                   # Sensor plugins (VLM, YOLO, video)
    actions/                  # Action plugins
    llm/                      # LLM plugins (OpenAI, Nebius, OpenRouter)
    simulators/               # Simulator plugins
    fuser/                    # Prompt assembly
  config/                     # JSON5 config files + schemas

src/                          # React frontend (Vite + TypeScript)
  hooks/                      # React hooks (useOpenEyeConnection, useOpenEyeStream, useFleetQueries, etc.)
  lib/                        # Client libraries (openeye-client.ts, openeye-ws.ts, fleet-client.ts, cred-api.ts)
  types/                      # TypeScript types (openeye.ts, fleet.ts, credits.ts, mlops.ts)
  components/dashboard/       # Dashboard components (LiveCameraFeed, DetectionCanvas, etc.)
  components/fleet/           # Fleet components (DeviceTable, DeploymentWizard, etc.)
  pages/dashboard/            # Dashboard pages (Inference, LiveStream, History, etc.)
  pages/dashboard/fleet/      # Fleet pages (FleetDashboard, Deployments, etc.)
```

## Quick Command Reference

```bash
# Model management
openeye list                              # Show available/downloaded models
openeye pull yolov8                       # Download model weights
openeye pull yolov8 --variant quantized   # Download quantized variant
openeye run yolov8 photo.jpg              # Run inference, output JSON
openeye run yolov8 photo.jpg --pretty     # Pretty-print results
openeye run grounding_dino img.png -p "find the red car"  # Open-vocab detection
openeye bench yolov8 --runs 20           # Benchmark inference speed
openeye remove yolov8                     # Delete downloaded weights
openeye serve yolov8                      # Start REST/WS server on :8000

# Configuration
openeye config set default_model yolov8
openeye config get default_model

# Fleet management (needs OPENEYE_FLEET_URL + OPENEYE_TOKEN)
openeye fleet register my-cam --type camera
openeye fleet ls --status online
openeye fleet deploy --name v2-rollout --model yolov8 --version 2.0 --strategy canary
openeye fleet rollback <deployment_id>

# MLOps
openeye mlops upload model.onnx --name "Custom" --key custom --format onnx
openeye mlops promote custom v1.0.0 production
openeye mlops ab-test custom --a v1.0.0 --b v2.0.0 --split 0.5
openeye mlops export custom v1.0.0 onnx --quantize
openeye mlops batch custom v1.0.0 ./images ./output --batch-size 32
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENEYE_FLEET_URL` | `http://localhost:8001` | Fleet control plane URL |
| `OPENEYE_TOKEN` | `""` | Bearer token for fleet API |
| `OPENEYE_DEVICE_API_KEY` | — | API key for device agent auth |
| `OPENAI_API_KEY` | — | Required for VLM perception mode |
| `GOOGLE_API_KEY` | — | Optional: Gemini VLM |
| `CAMERA_INDEX` | `0` | Default camera device index |
| `VITE_SUPABASE_URL` | — | Supabase project URL (frontend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | — | Supabase anon key (frontend) |

## Available Models & Adapters

| Model | Task | Adapter | Extras |
|-------|------|---------|--------|
| `yolov8` | detection | `yolov8` | `pip install openeye-ai[yolo]` |
| `depth_anything` | depth | `depth_anything` | `pip install openeye-ai[depth]` |
| `grounding_dino` | detection (open-vocab) | `grounding_dino` | `pip install openeye-ai[grounding]` |
| ONNX models | varies | `onnx_generic` / `yolov8:onnx` | `pip install openeye-ai[onnx]` |
| TensorRT models | varies | `tensorrt_generic` / `yolov8:tensorrt` | `pip install openeye-ai[tensorrt]` |

Install all extras: `pip install openeye-ai[all]`

## Creating a Custom Adapter

Extend `ModelAdapter` from `cli/openeye_ai/adapters/base.py`:

```python
from openeye_ai.adapters.base import ModelAdapter
from pathlib import Path
from PIL import Image

class Adapter(ModelAdapter):
    def _do_load(self, model_dir: Path) -> None:
        # Load weights from model_dir
        ...

    def _do_predict(self, image: Image.Image) -> dict:
        # Return {"detections": [...], "inference_ms": float}
        ...

    def pull(self, model_dir: Path) -> None:
        # Download weights to model_dir
        ...
```

Register it: `openeye register-adapter my-model ./my_adapter.py --task detection`

## Server API (when running `openeye serve`)

- `GET /health` — `{"status": "ok", "model": "<name>"}`
- `POST /predict` — Multipart file upload, returns `PredictionResult` JSON
- `GET /config` / `PUT /config` — Get/set runtime configuration
- `GET /metrics` — Prometheus-style inference metrics
- `GET /queue/status` — Request queue depth and status
- `WS /ws` — WebSocket for real-time streaming (send base64 frames, receive predictions)

## Build & Run Commands

```bash
# Frontend
npm install && npm run dev          # Dev server
npm run build                       # Production build
npm run test                        # Vitest tests
npm run lint                        # ESLint

# CLI
cd cli && pip install -e ".[all]"   # Install CLI with all extras
pytest                              # Run CLI tests

# Backend runtime
cd backend && pip install -r requirements.txt
python src/run.py openeye_vlm       # Start perception runtime

# Fleet control plane
cd backend && python -m uvicorn src.fleet.app:app --port 8001
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ImportError: ultralytics` | `pip install openeye-ai[yolo]` |
| `ImportError: onnxruntime` | `pip install openeye-ai[onnx]` |
| `Model 'x' not found` | Run `openeye list` to see available models, then `openeye pull x` |
| `Connection refused :8000` | Start server with `openeye serve <model>` |
| `Connection refused :8001` | Start fleet control plane or set `OPENEYE_FLEET_URL` |
| `401 Unauthorized (fleet)` | Set `OPENEYE_TOKEN` env var |
| `Camera not found` | Check `CAMERA_INDEX` or pass `--camera` to `openeye watch` |

## Detailed References

For full command signatures, API specs, and architecture details, read:
- `.claude/skills/openeye/CLI_REFERENCE.md` — All CLI commands with options
- `.claude/skills/openeye/API_REFERENCE.md` — Server endpoints, TypeScript clients, React hooks
- `.claude/skills/openeye/ARCHITECTURE.md` — Backend perception pipeline, mode system, plugin architecture

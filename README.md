# OpenEye

**Open-source eyes for the agent era.**

OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents. Pull, run, and serve computer-vision models from your terminal — like Ollama, but for vision AI.

## Features

- **Object Detection** — YOLOv8, YOLOv26, Grounding DINO, RF-DETR, and custom adapters
- **Depth Estimation** — Monocular depth via Depth Anything V2
- **Segmentation** — SAM2 segment anything
- **Scene Understanding** — Spatial relationships, scene graphs, natural language queries
- **VLM Reasoning** — Vision-language model integration (Nebius, OpenRouter)
- **Agentic Loop** — Continuous perception → reasoning → planning pipeline
- **Safety Monitoring** — Zone-based awareness with real-time human detection and robot halt
- **CLI-Native** — Every capability accessible from the terminal
- **REST + WebSocket API** — Serve models over HTTP with a single command
- **Fleet Management** — Register, deploy, and monitor edge devices at scale
- **MLOps** — Model registry, versioning, A/B testing, batch inference
- **Governance** — Policy enforcement, audit logging, safety rule management
- **Web Dashboard** — React-based UI for inference, live streams, fleet management, and more

## Quick Install

```bash
pip install openeye-sh
```

With YOLO support:

```bash
pip install "openeye-sh[yolo]"
```

## Quick Start

```bash
# Pull a model
openeye pull yolov8

# Run inference on an image
openeye run yolov8 photo.jpg

# Start the server with REST API, WebSocket, and browser dashboard
openeye serve yolov8

# Live camera feed with real-time detections
openeye watch --models yolov8

# Live camera feed with safety monitoring
openeye watch --models yolov8 --safety
```

## Interactive CLI Demo

An interactive walkthrough that runs real OpenEye commands against sample images. Great for evaluating the tool, onboarding, or live presentations.

### Prerequisites

- **Python 3.12** (torch requires <=3.12)
- **jq** (optional, for JSON pipeline steps — `brew install jq`)
- **curl** (for the API server step)

### Setup

```bash
# Create a virtual environment with Python 3.12
python3.12 -m venv .venv

# Install the CLI with YOLO and camera support
.venv/bin/pip install -e "./cli[yolo,camera]"

# Pull the YOLOv8 model (6 MB)
.venv/bin/openeye pull yolov8
```

### Run the Demo

```bash
./demo.sh
```

The demo is interactive — press **Enter** to advance between steps. Each step shows the command being run and its live output.

### What the Demo Covers

| Step | Command | What it demonstrates |
|------|---------|----------------------|
| 1 | `openeye list` | Browse the model registry (7 vision models) |
| 2 | `openeye pull yolov8` | Download a model — like `ollama pull` |
| 3 | `openeye run yolov8 scene-warehouse.jpg --pretty` | Object detection with structured JSON output |
| 4 | `openeye run yolov8 scene-kitchen.jpg --pretty` | Detection on a different scene (apple, cup, donut) |
| 5 | `openeye run ... --visualize` | Save an annotated image with bounding boxes |
| 6 | `openeye run ... \| jq` | Unix pipeline composability — pipe JSON to jq |
| 7 | `openeye bench yolov8` | Benchmark inference speed (latency, FPS, P95) |
| 8 | `openeye serve yolov8` | Launch a REST API server and query it with curl |
| 9 | Batch loop | Process all 4 demo images and summarize results |

### Demo Images

Four sample images are included in `src/assets/demo/`:

| Image | Scene | Typical detections |
|-------|-------|--------------------|
| `scene-warehouse.jpg` | Warehouse with people and vehicles | person, truck, tv |
| `scene-kitchen.jpg` | Kitchen countertop | apple, cup, donut, bottle |
| `scene-workshop.jpg` | Workshop environment | person, dining table, remote, knife |
| `safety-workspace.jpg` | Safety-critical workspace | (used for safety guardian demos) |

### Output

Annotated images are saved to `demo_output/`. The API server step temporarily runs on port 8111 and shuts down automatically.

### Beyond the Demo

Commands not covered in the scripted demo that you can try interactively:

```bash
# Live webcam detection with terminal overlay
openeye watch --models yolov8

# Safety Guardian — zone-based human proximity alerts
openeye watch --models yolov8 --safety --danger-m 0.5 --caution-m 1.5

# Unitree G1 robot safety demo (dry-run, no robot needed)
openeye g1-demo --control-mode dry_run --demo

# Agentic perception loop — perceive, reason, act
openeye agent run

# Edge device fleet management
openeye fleet status

# Open-vocabulary detection with text prompts (requires grounding-dino)
openeye pull grounding-dino
openeye run grounding-dino photo.jpg --prompt "person. hard hat. forklift."
```

## Project Structure

```
perceptify-the-world/
├── cli/              # openeye-sh CLI & inference server (Python)
├── backend/          # Perception engine runtime (Python)
├── src/              # React web frontend (TypeScript)
└── docs/             # MkDocs documentation site
```

| Package | Description | Language |
|---------|-------------|----------|
| `cli/` | CLI tool & FastAPI inference server (port 8000) | Python |
| `backend/` | Perception pipeline, fleet control plane (port 8001), governance engine | Python |
| `src/` | Web dashboard with live streams, fleet management, MLOps, and agentic UI | TypeScript/React |

## Tech Stack

**CLI & Backend**: Python, Typer, Rich, FastAPI, Uvicorn, Pydantic

**Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query

**Auth**: Supabase (Google/Apple OAuth)

**AI/ML**: Ultralytics (YOLO), Transformers, ONNX Runtime, TensorRT, LangChain

## Development

### Frontend

```bash
npm install
npm run dev
```

### CLI

```bash
cd cli
pip install -e ".[all]" --group dev
```

### Backend

```bash
cd backend
pip install -e . --group dev
```

## Documentation

Full documentation is available in the `docs/` directory, built with MkDocs Material.

## License

See [LICENSE](LICENSE) for details.

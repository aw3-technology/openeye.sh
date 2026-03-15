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
pip install openeye-ai
```

With YOLO support:

```bash
pip install "openeye-ai[yolo]"
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

## Project Structure

```
perceptify-the-world/
├── cli/              # openeye-ai CLI & inference server (Python)
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

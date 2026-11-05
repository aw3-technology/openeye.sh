# OpenEye

**Open-source eyes for the agent era.**

OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents. See, understand, and act — safely.

## Features

- **Object Detection** — YOLOv8, YOLO26, Grounding DINO, RF-DETR, and custom adapters
- **Depth Estimation** — Monocular depth via Depth Anything V2
- **Segmentation** — SAM2 segment anything
- **Scene Understanding** — Spatial relationships, scene graphs, natural language queries
- **VLM Reasoning** — Vision-language model integration via Nebius and OpenRouter
- **Agentic Loop** — Continuous perception → VLM reasoning → action planning pipeline with persistent memory
- **Safety Monitoring** — Zone-based awareness with real-time human detection and robot halt protocol
- **Governance** — Policy enforcement, PII filtering, audit logging, safety rule management
- **CLI-Native** — Every capability accessible from the terminal
- **Model-Agnostic** — Swap models without code changes via the adapter pattern
- **REST + WebSocket API** — Serve models over HTTP with a single command
- **Hosted API** — Object detection at `https://openeye.sh/v1` with an API key and pay-per-call credits, no setup
- **Web Dashboard** — [openeye.sh/dashboard](https://openeye.sh/dashboard) for API keys, credits, history, and fleet records; connect it to your own `openeye serve` for inference, live camera streams, and scene graphs
- **Fleet Management** — Register, deploy, and monitor edge devices at scale
- **MLOps** — Model registry, versioning, A/B testing, batch inference, shadow mode

## Quick Install

```bash
pipx install openeye-sh
```

With YOLO support:

```bash
pipx install "openeye-sh[yolo]"
```

## Quick Start

```bash
# Pull a model
openeye pull yolov8

# Run inference
openeye run yolov8 photo.jpg

# Start the server
openeye serve yolov8
```

Or skip the install and call the hosted API with a key from the dashboard:

```bash
curl -X POST https://openeye.sh/v1/detect \
  -H "Authorization: Bearer oe_your_key_here" \
  -F "file=@photo.jpg"
```

See the [Quickstart](getting-started/quickstart.md) for both paths.

## Packages

| Package | Description | Language |
|---------|-------------|----------|
| `cli/` | CLI tool & FastAPI inference server | Python |
| `backend/` | Perception pipeline, fleet control plane, governance engine | Python |
| `src/`, `api/` | Website and dashboard (Vite + React) and its Vercel functions: auth, data, credits, hosted `/v1` API | TypeScript |
| `db/` | Postgres schema (`schema.sql`) shared by the website and the fleet control plane | SQL |

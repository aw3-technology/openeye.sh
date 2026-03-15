# OpenEye

**Open-source eyes for the agent era.**

OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents. See, understand, and act — safely.

## Features

- **Object Detection** — YOLO, Grounding DINO, and custom adapters
- **Depth Estimation** — Monocular depth via Depth Anything V2
- **Scene Understanding** — Spatial relationships, hazard detection, scene graphs
- **Safety Guardian** — Sub-100ms human detection and robot halt
- **CLI-Native** — Every capability accessible from the terminal
- **Model-Agnostic** — Swap YOLO, VLMs, SAM without code changes
- **REST + WebSocket API** — Serve models over HTTP with a single command
- **Plugin Architecture** — Extensible inputs, actions, LLM providers

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

# Run inference
openeye run yolov8 photo.jpg

# Start the server
openeye serve yolov8
```

## Packages

| Package | Description | Language |
|---------|-------------|----------|
| `cli/` | CLI tool & inference server | Python |
| `backend/` | Perception engine runtime | Python |
| `src/` | Web frontend | TypeScript/React |

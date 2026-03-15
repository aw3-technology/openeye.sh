# OpenEye

**Open-source eyes for the agent era.**

OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents. See, understand, and act — safely.

## Features

- **Object Detection** — YOLOv8, YOLO26, Grounding DINO, RF-DETR, and custom adapters
- **Depth Estimation** — Monocular depth via Depth Anything V2
- **Segmentation** — Segment Anything 2 (SAM2)
- **Scene Understanding** — Spatial relationships, hazard detection, scene graphs
- **Safety Guardian** — Sub-100ms human detection and robot halt
- **Agentic Loop** — Continuous perception + reasoning + planning cycle
- **VLM Reasoning** — Cloud VLM integration (Nebius, OpenAI, Gemini, Anthropic, OpenRouter)
- **Fleet Management** — Edge device management, OTA updates, staged deployments
- **Governance** — Policy enforcement, PII filtering, rate limiting, safety zones
- **Desktop Vision** — Screen capture and analysis tools
- **MCP Server** — Model Context Protocol for desktop vision tools
- **ROS 2 Bridge** — Robotics integration via ROS 2 perception node
- **CLI-Native** — Every capability accessible from the terminal
- **Model-Agnostic** — Swap models without code changes via adapters
- **REST + WebSocket API** — Serve models over HTTP with a single command
- **Fleet Management** — Register, deploy, and monitor edge devices

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

# Live camera detections
openeye watch

# G1 Safety Guardian demo
openeye g1-demo
```

## Packages

| Package | Description | Language |
|---------|-------------|----------|
| `cli/` | CLI tool, model adapters, and FastAPI inference server | Python |
| `backend/` | Perception pipeline, fleet control plane, governance engine | Python |
| `src/` | Web dashboard with live streaming, fleet management, and MLOps | TypeScript/React |
| `integrations/` | ROS 2 perception node, OpenClaw integration | Python |

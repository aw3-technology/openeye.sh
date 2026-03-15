# OpenEye

**Ollama for vision AI models.** Pull, run, and serve computer-vision models from your terminal.

OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents. See, understand, and act — safely.

## Features

- **Object Detection** — YOLOv8, YOLO26, Grounding DINO, RF-DETR, and custom adapters
- **Depth Estimation** — Monocular depth via Depth Anything V2
- **Segmentation** — Segment Anything 2 (SAM2)
- **Scene Understanding** — Spatial relationships, hazard detection, scene graphs
- **Safety Guardian** — Sub-100ms human detection and robot halt
- **Agentic Loop** — Continuous perception + reasoning + planning cycle
- **VLM Reasoning** — Cloud VLM integration (Nebius, OpenAI, Gemini, Anthropic, OpenRouter)
- **Fleet Management** — Edge device management with OTA updates and staged deployments
- **Governance** — Policy enforcement, PII filtering, rate limiting, safety zones
- **Desktop Vision** — Screen capture and analysis tools
- **MCP Server** — Model Context Protocol integration for desktop vision tools
- **ROS 2 Bridge** — Robotics integration via ROS 2 perception node
- **CLI-Native** — Every capability accessible from the terminal
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

# Run inference on an image
openeye run yolov8 photo.jpg

# Start the inference server
openeye serve yolov8

# Live camera feed with detections
openeye watch

# Run the G1 Safety Guardian demo
openeye g1-demo
```

## Architecture

```
perceptify-the-world/
├── cli/              # openeye-ai CLI & inference server (Python/Typer)
├── backend/          # Perception engine runtime & fleet control plane (Python)
├── src/              # React frontend dashboard (TypeScript/Vite)
├── integrations/     # ROS 2 bridge, OpenClaw integration
├── docs/             # MkDocs documentation site
└── scripts/          # Build and code generation scripts
```

| Component | Description | Language |
|-----------|-------------|----------|
| `cli/` | CLI tool, model adapters, and FastAPI inference server | Python |
| `backend/` | Perception pipeline, fleet control plane (port 8001), governance engine | Python |
| `src/` | Web dashboard with live streaming, fleet management, and MLOps UI | TypeScript/React |
| `integrations/` | ROS 2 perception node, OpenClaw robot integration | Python |

## CLI Commands

```bash
# Model management
openeye list                    # Show available/downloaded models
openeye pull yolov8             # Download model weights
openeye remove yolov8           # Delete downloaded weights
openeye run yolov8 photo.jpg    # Run inference

# Server & streaming
openeye serve yolov8            # Start REST/WebSocket server on port 8000
openeye watch                   # Live camera detections
openeye bench yolov8            # Benchmark inference speed

# Demos
openeye g1-demo                 # Unitree G1 Safety Guardian demo

# Subcommands
openeye config get|set|reset    # Configuration management
openeye fleet ...               # Fleet device management
openeye mlops ...               # Model lifecycle & A/B testing
openeye govern ...              # Policy management
openeye desktop ...             # Desktop capture & analysis
openeye debug ...               # Debugging tools
openeye robotics ...            # Robotics integration
openeye mcp                     # Start MCP server
```

## Server API

When running `openeye serve <model>`, the server exposes:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check and model status |
| `POST /predict` | Image upload for inference |
| `GET /metrics` | Prometheus metrics |
| `WS /ws` | Real-time inference streaming |
| `WS /ws/perception` | Full perception pipeline (detection + scene graph) |
| `WS /ws/vlm` | VLM reasoning endpoint |
| `WS /ws/agentic` | Agentic loop (detect + reason + plan) |
| `GET /nebius/stats` | VLM usage statistics |

## Tech Stack

**CLI & Backend:**
- Python 3.10+, Typer, FastAPI, Pydantic
- YOLOv8/YOLO26, Depth Anything V2, SAM2, Grounding DINO, RF-DETR
- Prometheus metrics, slowapi rate limiting

**Frontend:**
- React, TypeScript, Vite
- Tailwind CSS, shadcn/ui
- TanStack React Query, Supabase Auth

## Optional Dependencies

```bash
pip install "openeye-ai[yolo]"        # YOLOv8 detection
pip install "openeye-ai[depth]"       # Depth estimation
pip install "openeye-ai[grounding]"   # Grounding DINO
pip install "openeye-ai[sam]"         # Segment Anything 2
pip install "openeye-ai[rfdetr]"      # RF-DETR detection
pip install "openeye-ai[onnx]"        # ONNX Runtime
pip install "openeye-ai[tensorrt]"    # TensorRT
pip install "openeye-ai[camera]"      # OpenCV camera support
pip install "openeye-ai[desktop]"     # Screen capture (mss)
pip install "openeye-ai[mcp]"         # MCP server
pip install "openeye-ai[robotics]"    # gRPC + MQTT for robotics
pip install "openeye-ai[all]"         # YOLO + depth + grounding + OpenCV
```

## Development

```bash
# Frontend
npm install && npm run dev

# CLI
cd cli && pip install -e ".[all]" --group dev
pytest -v

# Backend
cd backend && pip install -e . --group dev
pytest -v
```

## Documentation

Full documentation: [docs.perceptify.dev](https://docs.perceptify.dev)

## License

MIT

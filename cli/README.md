# openeye-sh

**Ollama for vision AI models** — pull, run, and serve computer-vision models from your terminal.

## Install

```bash
pipx install openeye-sh
```

With extras:

```bash
pipx install "openeye-sh[yolo]"        # YOLO object detection
pipx install "openeye-sh[depth]"       # Monocular depth estimation
pipx install "openeye-sh[camera]"      # OpenCV camera support
pipx install "openeye-sh[all]"         # YOLO + depth + grounding + camera
```

## Quick Start

```bash
# List available models
openeye list

# Pull a model
openeye pull yolov8n

# Run inference on an image
openeye run yolov8n image.jpg

# Start the API server
openeye serve

# Live camera stream with detection
openeye watch --model yolov8n
```

## Features

- **Model management** — pull, list, and run vision models (YOLO, depth, grounding, SAM, RF-DETR)
- **REST & WebSocket API** — FastAPI server with `/predict`, streaming WebSocket endpoints
- **Live perception** — real-time camera inference with VLM reasoning
- **Fleet control plane** — manage distributed vision agents
- **Agentic loop** — continuous perception + reasoning + planning pipeline
- **Safety guardian** — configurable safety zone monitoring for robotics

## Links

- [Homepage](https://perceptify.dev)
- [Repository](https://github.com/aw3-technology/openeye.sh)

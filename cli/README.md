# openeye-ai

**Ollama for vision AI models** — pull, run, and serve computer-vision models from your terminal.

## Install

```bash
pip install openeye-ai
```

With extras:

```bash
pip install openeye-ai[yolo]        # YOLO object detection
pip install openeye-ai[depth]       # Monocular depth estimation
pip install openeye-ai[camera]      # OpenCV camera support
pip install openeye-ai[all]         # YOLO + depth + grounding + camera
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
- [Repository](https://github.com/OpenEye/perceptify-the-world)

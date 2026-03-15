---
title: openeye serve
---

Start a FastAPI inference server with REST API, WebSocket streaming, and a browser dashboard.

```bash
openeye serve yolov8
openeye serve yolov8 --port 9000
openeye serve yolov8 --demo
openeye serve yolov8 --vlm-model Qwen/Qwen3-VL-72B
```

### Options

| Flag | Description |
|------|-------------|
| --host <addr> | Bind address (default: 0.0.0.0) |
| --port <num> | Port number (default: 8000) |
| --demo | Demo mode: warm up model for zero cold-start, show live status bar |
| --vlm-model <id> | VLM model ID for the /ws/vlm endpoint |
| --cortex-llm <id> | Cortex LLM model ID for agentic reasoning |

### Endpoints

The server exposes:

| Endpoint | Description |
|----------|-------------|
| GET / | Browser dashboard |
| POST /predict | REST inference (multipart form) |
| WS /ws | WebSocket inference stream |
| WS /ws/perception | Full perception pipeline with scene graph |
| WS /ws/vlm | VLM reasoning stream |
| WS /ws/agentic | Agentic loop stream |
| GET /metrics | Prometheus metrics |
| GET /health | Health check |
| GET /queue/status | Inference queue status |

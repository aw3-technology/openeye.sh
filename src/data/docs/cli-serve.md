---
title: openeye serve
---

Start a FastAPI inference server with REST API, WebSocket streaming, and a built-in browser page. The model must be pulled first.

```bash
openeye serve yolov8
openeye serve yolov8 --port 9000
openeye serve yolov8 --demo
openeye serve yolov8 --vlm-model qwen/qwen3.5-9b
openeye serve depth-anything
```

### Options

| Flag | Description |
|------|-------------|
| MODEL | Model to serve (required) |
| --host <addr> | Bind address (default: 0.0.0.0) |
| --port <num> | Port number (default: 8000) |
| --demo | Demo mode: warm up the model for zero cold-start, show a live status bar |
| --vlm-model <id> | VLM model ID for perception (e.g. qwen/qwen3.5-9b) |
| --cortex-llm <id> | Cortex LLM model ID for reasoning (e.g. z-ai/glm-5-turbo) |

VLM features need OPENROUTER_API_KEY or NEBIUS_API_KEY in the environment.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| GET / | Built-in browser page |
| POST /predict | REST inference (multipart form) |
| POST /perception | Perception pipeline on one image |
| POST /vlm/analyze | VLM analysis of one image |
| POST /v1/detect, /v1/depth, /v1/describe | Hosted-API-compatible routes (Bearer oe_ key) |
| GET /v1/models, /v1/usage | Hosted-API-compatible model list and in-memory usage |
| WS /ws | WebSocket inference stream |
| WS /ws/perception | Full perception pipeline with scene graph |
| WS /ws/vlm | VLM reasoning stream |
| WS /ws/agentic | Agentic loop stream |
| /agent/*, /governance/*, /mlops/* | Agent, Governance, and MLOps APIs |
| GET /metrics | Prometheus metrics |
| GET /health | Health check |
| GET /queue/status | Inference queue status |
| GET, PUT /config | Runtime config |
| GET /nebius/stats | Nebius VLM usage |

See REST Endpoints and WebSocket for details. The /governance routes are mounted only when the governance engine can be imported.

### Use it from the openeye.sh dashboard

The server's CORS defaults allow https://openeye.sh, and it answers Chrome's Private Network Access preflight, so the hosted dashboard can connect to it. Open https://openeye.sh/dashboard, click Server on the Overview page, and enter http://localhost:8000 (or your --port). Pages that need a live server — Inference, Live, Scene Graph, Metrics, Benchmark, Config, Governance, MLOps, and the live agent loop — then use it.

To change the allowed origins, set CORS_ORIGINS to a comma-separated list; it replaces the default list (https://openeye.sh, https://www.openeye.sh, http://localhost:5173, http://localhost:3000, http://localhost:8080).

### Securing the /v1 routes

By default the /v1 routes accept any Bearer key starting with oe_. Set OPENEYE_SERVER_API_KEY to require one exact key:

```bash
OPENEYE_SERVER_API_KEY=oe_my_secret openeye serve yolov8
```

The other routes (/predict, WebSockets, /config, ...) have no authentication, so don't expose the server to untrusted networks.

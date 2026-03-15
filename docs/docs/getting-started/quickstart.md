# Quickstart

This guide walks you through pulling a model, running inference, and starting the API server.

## 1. Pull a Model

Download YOLOv8 weights to your local cache:

```bash
openeye pull yolov8
```

This downloads the model to `~/.openeye/models/yolov8/`.

## 2. Run Inference

Run object detection on an image:

```bash
openeye run yolov8 photo.jpg
```

Output is structured JSON:

```json
{
  "model": "yolov8",
  "task": "detection",
  "objects": [
    {
      "label": "person",
      "confidence": 0.95,
      "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}
    }
  ],
  "inference_ms": 12.3
}
```

## 3. Start the Server

Serve the model over HTTP:

```bash
openeye serve yolov8
```

The server starts at `http://localhost:8000` with:

- `GET /health` — Health check
- `POST /predict` — Upload an image for inference
- `GET /` — Browser dashboard
- `WS /ws` — Real-time inference streaming
- `WS /ws/perception` — Full perception pipeline
- `WS /ws/vlm` — VLM reasoning
- `WS /ws/agentic` — Agentic loop (perception + reasoning + planning)
- `GET /metrics` — Prometheus metrics

## 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

## 5. Live Camera Feed

Stream your webcam with real-time detections:

```bash
openeye watch
```

## 6. List Available Models

```bash
openeye list
```

Shows all registered models with download status.

## 7. Benchmark Performance

```bash
openeye bench yolov8 --runs 20
```

## Next Steps

- [CLI Commands](../cli/commands.md) — Full command reference
- [Server API](../cli/server-api.md) — REST and WebSocket endpoints
- [Architecture](../backend/architecture.md) — Backend perception pipeline

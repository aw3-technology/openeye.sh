# Quickstart

This guide walks you through pulling a model, running inference, starting the API server, and using live camera feeds.

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

Save an annotated image with bounding boxes:

```bash
openeye run yolov8 photo.jpg --visualize
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
- `WebSocket /ws` — Real-time inference
- `WebSocket /ws/perception` — Full perception pipeline with scene graph
- `WebSocket /ws/vlm` — VLM reasoning (requires `--vlm-model` or `NEBIUS_API_KEY`)
- `WebSocket /ws/agentic` — Continuous agentic loop
- `GET /metrics` — Prometheus metrics
- `GET /nebius/stats` — VLM usage statistics

To enable VLM reasoning:

```bash
openeye serve yolov8 --vlm-model qwen/qwen3.5-9b
```

For demo mode with zero cold-start and a live status bar:

```bash
openeye serve yolov8 --demo
```

## 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

## 5. Live Camera Feed

Watch live detections in the terminal:

```bash
openeye watch --models yolov8
```

With safety monitoring:

```bash
openeye watch --models yolov8 --safety
```

With a video file fallback:

```bash
openeye watch --models yolov8 --video demo.mp4
```

## 6. List Available Models

```bash
openeye list
```

Shows all registered models with download status and hardware tags.

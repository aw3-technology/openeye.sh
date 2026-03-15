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
- `WebSocket /ws` — Real-time inference

## 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

## 5. List Available Models

```bash
openeye list
```

Shows all registered models with download status.

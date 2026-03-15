---
title: Quickstart
---

This guide walks you through pulling a model, running inference, starting the API server, and live camera detection.

### 1. Pull a Model

Download YOLOv8 weights to your local cache:

```bash
openeye pull yolov8
```

This downloads the model to ~/.openeye/models/yolov8/.

### 2. Run Inference

Run object detection on an image:

```bash
openeye run yolov8 photo.jpg --pretty
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

### 3. Start the Server

Serve the model over HTTP:

```bash
openeye serve yolov8
```

The server starts at http://localhost:8000 with REST, WebSocket, and a browser dashboard.

### 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

### 5. Live Camera Detection

Watch your webcam with real-time detections in the terminal:

```bash
openeye watch --models yolov8
```

Add safety zone monitoring:

```bash
openeye watch --models yolov8 --safety
```

### 6. List Available Models

```bash
openeye list
```

Shows all registered models with download status, task type, size, and hardware support.

### Interactive Demo

Run the included interactive demo script for a guided walkthrough of all major features:

```bash
./demo.sh
```

See the demo documentation for full details on what it covers.

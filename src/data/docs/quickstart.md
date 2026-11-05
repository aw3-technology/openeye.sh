---
title: Quickstart
---

Pick a path. Path A runs models on your own machine with the CLI (free). Path B calls the hosted API at https://openeye.sh/v1 with an API key (paid in credits, nothing to install).

## Path A: Self-hosted CLI

Install the CLI first (see Installation): pipx install "openeye-sh[yolo]"

### 1. Pull a Model

Download YOLOv8 weights to your local cache:

```bash
openeye pull yolov8
```

This downloads the model to ~/.openeye/models/yolov8/.

### 2. Run Inference

Run object detection on an image:

```bash
openeye run yolov8 photo.jpg
```

Output is one line of JSON on stdout (add --pretty for a human-readable summary on stderr):

```json
{
  "model": "yolov8",
  "task": "detection",
  "timestamp": "2026-11-05T12:00:00+00:00",
  "image": { "width": 1280, "height": 720, "source": "photo.jpg" },
  "objects": [
    {
      "label": "person",
      "confidence": 0.95,
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4 }
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

The server listens on http://localhost:8000 with REST, WebSocket streaming, and a built-in browser page at /.

### 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

The same server also exposes the hosted API's routes under /v1 (detect, depth, describe, models, usage) for any Bearer key starting with oe_, running whichever model you served. Credits there are only counted in memory; nothing is charged. See REST Endpoints for the differences from the hosted API.

### 5. Connect the openeye.sh Dashboard

The dashboard at https://openeye.sh/dashboard can drive your local server. openeye serve allows the https://openeye.sh origin by default (plus Chrome's Private Network Access preflight), so no extra setup is needed:

- Sign in at https://openeye.sh/login (or use Continue as Demo User)
- On the dashboard Overview page, click Server and enter http://localhost:8000
- Inference, Live, Scene Graph, Metrics, Benchmark, the Config editor, Governance, MLOps, and the live agent loop now run against your server

If your browser still blocks an HTTPS page from calling localhost, serve OpenEye over HTTPS (for example behind a reverse proxy) and enter that URL instead. To allow other origins, set CORS_ORIGINS (comma-separated) before starting the server; it replaces the default list.

### 6. Live Camera Detection

Watch your webcam with real-time detections in the terminal:

```bash
openeye watch --models yolov8
```

Add safety zone monitoring:

```bash
openeye watch --models yolov8 --safety
```

### 7. List Available Models

```bash
openeye list
```

Shows all registered models with task, description, size, hardware support, variants, and download status.

## Path B: Hosted API

### 1. Get an API Key

Sign in at https://openeye.sh/login (email and password, or Continue with 1Profile). In the dashboard open Settings → API Keys and create a key. Keys start with oe_ and are shown once; copy it somewhere safe.

### 2. Buy Credits

Open Settings → Credits in the dashboard. Each detection costs 1 credit; calls without enough credits get 402.

### 3. Call the API

With curl:

```bash
curl -X POST https://openeye.sh/v1/detect \
  -H "Authorization: Bearer oe_your_key_here" \
  -F "file=@photo.jpg"
```

With Python:

```python
import requests

resp = requests.post(
    "https://openeye.sh/v1/detect",
    headers={"Authorization": "Bearer oe_your_key_here"},
    files={"file": open("photo.jpg", "rb")},
)
resp.raise_for_status()
for obj in resp.json()["objects"]:
    print(obj["label"], obj["confidence"])
```

With the CLI (no models to download for this):

```bash
pipx install openeye-sh
export OPENEYE_API_KEY=oe_your_key_here
openeye api detect photo.jpg
openeye api usage
```

### 4. Check Your Usage

openeye api usage (or GET /v1/usage) shows your remaining balance and recent calls. The dashboard's Settings → Credits page shows the same balance.

> [!info] What's live on the hosted API: POST /v1/detect, GET /v1/models, and GET /v1/usage. POST /v1/describe returns 503 until scene description is enabled; POST /v1/depth returns 501 (self-hosted only). There is no WebSocket streaming on the hosted API — use openeye serve for that.

### Interactive Demo

From a clone of the repository, run the included interactive demo script for a guided walkthrough of the CLI:

```bash
./demo.sh
```

# Quickstart

There are two ways to use OpenEye:

- **Hosted API** — send images to `https://openeye.sh/v1` with an API key and pay per call in credits. Nothing to download.
- **Self-hosted** — pull models and run them on your own hardware with the CLI. Free.

## Hosted API Quickstart

1. **Get a key.** Sign in at [openeye.sh](https://openeye.sh) (email and password or 1Profile), open **Dashboard → Settings → API Keys**, and create a key. It starts with `oe_` and is shown once.
2. **Buy credits** under **Dashboard → Settings → Credits**. Detection costs 1 credit per call; calls without enough credits return `402`.
3. **Call the API.**

    With curl:

    ```bash
    curl -X POST https://openeye.sh/v1/detect \
      -H "Authorization: Bearer oe_your_key_here" \
      -F "file=@photo.jpg" \
      -F "confidence=0.3"
    ```

    With Python:

    ```python
    import requests

    resp = requests.post(
        "https://openeye.sh/v1/detect",
        headers={"Authorization": "Bearer oe_your_key_here"},
        files={"file": open("photo.jpg", "rb")},
        data={"confidence": 0.3},
    )
    resp.raise_for_status()
    for obj in resp.json()["objects"]:
        print(obj["label"], obj["confidence"], obj["bbox"])
    ```

    With the CLI:

    ```bash
    export OPENEYE_API_KEY=oe_your_key_here
    openeye api detect photo.jpg
    openeye api usage
    ```

4. **Check usage** with `openeye api usage` or `GET https://openeye.sh/v1/usage`.

What's live on the hosted API:

| Endpoint | Status | Credits |
|----------|--------|---------|
| `POST /v1/detect` | Live: YOLOv8 Nano (80 COCO classes), JPEG/PNG under 4 MB | 1 |
| `GET /v1/models`, `GET /v1/usage` | Live | — |
| `POST /v1/describe` | Returns `503` until scene description is enabled | 3 |
| `POST /v1/depth` | Returns `501`; run it self-hosted with `openeye serve depth-anything` | — |

Each key allows 60 requests per minute by default (`429` with `Retry-After` past that). The hosted API has no WebSocket streaming; for real-time streams, run `openeye serve`. Credits are refunded if inference fails. Full reference: [openeye.sh/docs](https://openeye.sh/docs).

## Self-Hosted Quickstart

The rest of this guide walks you through pulling a model, running inference, starting the API server, and using live camera feeds.

### 1. Pull a Model

Download YOLOv8 weights to your local cache:

```bash
openeye pull yolov8
```

This downloads the model to `~/.openeye/models/yolov8/`.

### 2. Run Inference

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

### 3. Start the Server

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
- `POST /v1/detect`, `/v1/depth`, `/v1/describe`, `GET /v1/models`, `/v1/usage` — the hosted API's routes, served locally (any `oe_` Bearer key; no credits charged)

To enable VLM reasoning:

```bash
openeye serve yolov8 --vlm-model qwen/qwen3.5-9b
```

For demo mode with zero cold-start and a live status bar:

```bash
openeye serve yolov8 --demo
```

### 4. Query the API

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

Or use the dashboard: open [openeye.sh/dashboard](https://openeye.sh/dashboard), click **Server** on the Overview page, and enter `http://localhost:8000`. See [Connect the openeye.sh dashboard](../cli/server-api.md#connect-the-openeyesh-dashboard).

### 5. Live Camera Feed

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

### 6. List Available Models

```bash
openeye list
```

Shows all registered models with download status and hardware tags.

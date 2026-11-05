# Response Schemas

Example JSON responses from the OpenEye hosted API (`https://openeye.sh/v1`).

## POST /v1/detect

```json
{
  "model": "yolov8",
  "objects": [
    {
      "label": "person",
      "confidence": 0.92,
      "bbox": { "x": 0.12, "y": 0.08, "w": 0.35, "h": 0.80 }
    },
    {
      "label": "chair",
      "confidence": 0.78,
      "bbox": { "x": 0.55, "y": 0.40, "w": 0.25, "h": 0.45 }
    }
  ],
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 183.4,
  "credits_used": 1
}
```

Bounding boxes are normalized (0–1): `x`,`y` is the top-left corner, `w`,`h` the size.

## POST /v1/describe

Hosted: returns 503 until enabled. When enabled:

```json
{
  "model": "qwen/qwen2.5-vl-72b-instruct",
  "description": "A person sits at a wooden desk with an open laptop; a coffee mug is to the right and a bookshelf is in the background.",
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 2105.3,
  "credits_used": 3
}
```

## POST /v1/depth

Hosted: always 501:

```json
{ "error": "Depth isn't available on the hosted API yet. Run it with `openeye serve depth-anything`." }
```

A local `openeye serve depth-anything` returns `model`, `depth_map` (base64 PNG), `image`, `inference_ms`, `credits_used`.

## GET /v1/models

```json
[
  {
    "id": "yolov8",
    "name": "YOLOv8 Nano",
    "task": "detection",
    "credits_per_call": 1,
    "description": "Real-time object detection with 80 COCO classes.",
    "available": true
  },
  {
    "id": "qwen2.5-vl",
    "name": "Qwen2.5-VL",
    "task": "description",
    "credits_per_call": 3,
    "description": "Scene description and visual Q&A.",
    "available": false
  },
  {
    "id": "depth-anything-v2",
    "name": "Depth Anything V2",
    "task": "depth",
    "credits_per_call": 2,
    "description": "Monocular depth estimation. Self-hosted only for now (openeye serve).",
    "available": false
  }
]
```

## GET /v1/usage

```json
{
  "balance": 847,
  "credits_remaining": 847,
  "total_requests": 153,
  "total_calls": 153,
  "total_credits_used": 153,
  "credits_used": 153,
  "by_endpoint": { "/v1/detect": 153 },
  "daily_credits": { "2026-11-03": 15, "2026-11-04": 22 },
  "truncated": false
}
```

`balance` and `credits_remaining` are the same value; `total_requests`/`total_calls` and `total_credits_used`/`credits_used` are aliases kept for different clients.

## Errors

```json
{ "error": "Not enough credits. Buy more at https://openeye.sh/dashboard/settings/credits" }
```

## GET /devices (self-hosted fleet control plane)

```json
[
  {
    "id": "6f1c2a4e-0b7d-4c1e-9a55-2f3b8d9e1c07",
    "name": "warehouse-cam-01",
    "device_type": "camera",
    "status": "online",
    "firmware_version": "2.1.0",
    "current_model_id": "yolov8",
    "current_model_version": "v2.1.0",
    "last_heartbeat_at": "2026-11-04T10:30:00Z",
    "tags": { "location": "warehouse-a", "floor": "1" }
  }
]
```

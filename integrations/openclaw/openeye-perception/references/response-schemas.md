# Response Schemas

Example JSON responses for each OpenEye Hosted API endpoint.

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
  "inference_ms": 23.4,
  "credits_used": 1
}
```

Bounding boxes are normalized (0–1) relative to image dimensions.

## POST /v1/depth

```json
{
  "model": "depth-anything-v2",
  "depth_map": "<base64-encoded PNG>",
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 45.1,
  "credits_used": 2
}
```

`depth_map` is a base64-encoded grayscale PNG where lighter pixels are closer.

## POST /v1/describe

```json
{
  "model": "gpt-4o",
  "description": "The image shows a person sitting at a wooden desk in a home office. There is a laptop open in front of them, a coffee mug to the right, and a bookshelf in the background.",
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 1205.3,
  "credits_used": 3
}
```

## GET /v1/models

```json
[
  {
    "id": "yolov8",
    "name": "YOLOv8 Nano",
    "task": "detection",
    "credits_per_call": 1,
    "description": "Real-time object detection with 80 COCO classes."
  },
  {
    "id": "depth-anything-v2",
    "name": "Depth Anything V2",
    "task": "depth",
    "credits_per_call": 2,
    "description": "Monocular depth estimation producing dense depth maps."
  },
  {
    "id": "gpt-4o",
    "name": "GPT-4o Vision",
    "task": "description",
    "credits_per_call": 3,
    "description": "Scene description and visual Q&A powered by GPT-4o."
  }
]
```

## GET /v1/usage

```json
{
  "balance": 847,
  "total_requests": 153,
  "total_credits_used": 312,
  "by_endpoint": {
    "/v1/detect": 95,
    "/v1/depth": 38,
    "/v1/describe": 20
  },
  "daily_credits": {
    "2026-03-14": 15,
    "2026-03-13": 22,
    "2026-03-12": 8
  }
}
```

## GET /devices

```json
[
  {
    "id": "dev_abc123",
    "name": "warehouse-cam-01",
    "device_type": "camera",
    "status": "online",
    "firmware_version": "2.1.0",
    "current_model_id": "yolov8",
    "current_model_version": "v2.1.0",
    "last_heartbeat_at": "2026-03-15T10:30:00Z",
    "tags": { "location": "warehouse-a", "floor": "1" }
  }
]
```

## GET /devices/{device_id}

Same shape as a single element of the list response, with additional fields:

```json
{
  "id": "dev_abc123",
  "user_id": "usr_xyz",
  "name": "warehouse-cam-01",
  "device_type": "camera",
  "status": "online",
  "hardware_specs": { "cpu": "ARM Cortex-A72", "ram_mb": 4096, "gpu": "none" },
  "tags": { "location": "warehouse-a" },
  "config_overrides": { "danger_zone_m": 0.5 },
  "firmware_version": "2.1.0",
  "current_model_id": "yolov8",
  "current_model_version": "v2.1.0",
  "ip_address": "192.168.1.42",
  "last_heartbeat_at": "2026-03-15T10:30:00Z",
  "registered_at": "2026-01-10T08:00:00Z",
  "created_at": "2026-01-10T08:00:00Z",
  "updated_at": "2026-03-15T10:30:00Z"
}
```

## GET /alerts

```json
[
  {
    "id": "alert_001",
    "device_id": "dev_abc123",
    "alert_type": "temperature_high",
    "severity": "warning",
    "title": "High CPU temperature",
    "message": "Device warehouse-cam-01 CPU temperature reached 85°C",
    "resolved": false,
    "created_at": "2026-03-15T09:45:00Z"
  }
]
```

## Error Response

```json
{
  "detail": "Insufficient credits. This request costs 2 credit(s)."
}
```

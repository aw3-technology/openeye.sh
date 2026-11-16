---
title: GET /v1/models
---

Lists the hosted models, what each costs, and whether it's available right now. Free and public: no API key needed.

```bash
curl https://openeye.sh/v1/models
```

```json
[
  { "id": "yolov8", "name": "YOLOv8 Nano", "task": "detection", "credits_per_call": 1,
    "description": "Real-time object detection with 80 COCO classes.", "available": true },
  { "id": "qwen2.5-vl", "name": "Qwen2.5-VL", "task": "description", "credits_per_call": 3,
    "description": "Scene description and visual Q&A.", "available": false },
  { "id": "depth-anything-v2", "name": "Depth Anything V2", "task": "depth", "credits_per_call": 2,
    "description": "Monocular depth estimation. Self-hosted only for now (openeye serve).", "available": false }
]
```

| Model | Endpoint | Status |
|-------|----------|--------|
| yolov8 | POST /v1/detect | Available |
| qwen2.5-vl | POST /v1/describe | Becomes available when the VLM is enabled; returns 503 until then |
| depth-anything-v2 | POST /v1/depth | Not hosted; returns 501 |

From the CLI: `openeye api models` (`--json` for the raw response; works without OPENEYE_API_KEY). `GET https://openeye.sh/v1` is also public and returns a JSON index of every endpoint, its methods, and whether it needs a key. For models on your own machine, run `openeye list`.

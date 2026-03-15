---
title: GET /v1/models
---

List all available models with their credit costs. No credits charged.

```bash
curl https://api.openeye.ai/v1/models \
  -H "X-API-Key: oe_live_abc123"
```

### Response

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

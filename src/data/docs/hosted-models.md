---
title: GET /v1/models
---

Lists the hosted models, what each costs, and whether it's available right now.

```bash
curl https://openeye.sh/v1/models \
  -H "Authorization: Bearer oe_your_key_here"
```

```json
[
  { "id": "yolov8", "name": "YOLOv8 Nano", "task": "detection", "credits_per_call": 1, "available": true },
  { "id": "qwen2.5-vl", "name": "Qwen2.5-VL", "task": "description", "credits_per_call": 3, "available": false },
  { "id": "depth-anything-v2", "name": "Depth Anything V2", "task": "depth", "credits_per_call": 2, "available": false }
]
```

For models on your own machine, run `openeye list`.

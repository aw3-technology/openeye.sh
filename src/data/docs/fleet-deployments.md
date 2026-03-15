---
title: Deployments
---

Deployments push model updates to groups of edge devices using staged rollout strategies.

### POST /deployments — Create Deployment

```bash
curl -X POST https://api.openeye.ai/deployments \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "yolov8-upgrade-v2",
    "model_id": "yolov8",
    "model_version": "2.0.0",
    "model_url": "https://models.openeye.ai/yolov8-v2.pt",
    "strategy": "canary",
    "rollout_stages": [
      {"name": "canary", "percentage": 10, "min_wait_seconds": 300},
      {"name": "rollout-50", "percentage": 50, "min_wait_seconds": 600},
      {"name": "full", "percentage": 100, "min_wait_seconds": 0}
    ],
    "target_group_id": "group-uuid-here"
  }'
```

### Rollout Strategies

| Strategy | Description |
|----------|-------------|
| canary | Deploy to a small percentage first, then expand in stages |
| rolling | Gradually roll out to all devices in batches |
| blue_green | Switch all devices at once after validation |
| all_at_once | Deploy to all target devices simultaneously |

### POST /deployments/:id/advance — Advance Stage

```bash
curl -X POST https://api.openeye.ai/deployments/<id>/advance \
  -H "Authorization: Bearer <jwt>"
```

### POST /deployments/:id/rollback — Rollback

```bash
curl -X POST https://api.openeye.ai/deployments/<id>/rollback \
  -H "Authorization: Bearer <jwt>"
```

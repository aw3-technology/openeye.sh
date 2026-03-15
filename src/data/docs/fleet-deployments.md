---
title: Deployments
---

Deployments push model updates to groups of edge devices using staged rollout strategies.

### Create a Deployment

```bash
openeye fleet deploy --name "yolo-v2-rollout" --model yolov8 --version v2.1.0 --strategy canary
```

### Rollout Strategies

| Strategy | Description |
|----------|-------------|
| canary | Deploy to a small percentage first, then expand in stages |
| rolling | Gradually roll out to all devices in batches |
| blue_green | Switch all devices at once after validation |
| all_at_once | Deploy to all target devices simultaneously |

### Rollback

```bash
openeye fleet rollback <deployment-id>
```

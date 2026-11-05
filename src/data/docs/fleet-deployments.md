---
title: Deployments
---

Deployments push model updates to groups of edge devices using staged rollout strategies.

### Create a Deployment

```bash
openeye fleet deploy --name "yolo-v2-rollout" --model yolov8 --version v2.1.0 --strategy canary
openeye fleet deploy --model yolov8 --version v2.1.0 --group <group-id> --url https://example.com/yolov8.onnx
```

--model and --version are required; --name is generated if omitted, and --strategy defaults to canary. REST: `POST /deployments` with JSON body. On openeye.sh, the dashboard's Fleet → Deployments page creates and tracks deployments (with per-device status) in your account.

### Rollout Strategies

| Strategy | Description |
|----------|-------------|
| canary | Deploy to a small percentage first, then expand in stages |
| rolling | Gradually roll out to all devices in batches |
| blue_green | Switch all devices at once after validation |
| all_at_once | Deploy to all target devices simultaneously |

### Deployment REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /deployments | Create deployment |
| GET | /deployments | List deployments (filter by `status`) |
| GET | /deployments/{id} | Get deployment details |
| GET | /deployments/{id}/devices | Get device statuses for deployment |
| POST | /deployments/{id}/advance | Advance deployment stage |
| POST | /deployments/{id}/pause | Pause deployment |
| POST | /deployments/{id}/rollback | Rollback deployment |

### Manage a Rollout

```bash
openeye fleet deployments --status in_progress
openeye fleet advance <deployment-id>
openeye fleet pause-deployment <deployment-id>
openeye fleet rollback <deployment-id>
```

### OTA Updates

```bash
openeye fleet ota --url https://example.com/agent-1.3.0.tar.gz --version 1.3.0 --group <group-id>
openeye fleet ota --url https://example.com/agent-1.3.0.tar.gz --version 1.3.0 --devices <id1>,<id2> --force
```

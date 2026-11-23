---
title: Deployments
---

Deployments push model updates to groups of edge devices using staged rollout strategies.

### Create a Deployment

```bash
openeye fleet deploy --name "yolo-v2-rollout" --model yolov8 --version v2.1.0 --strategy canary --group <group-id>
openeye fleet deploy --model yolov8 --version v2.1.0 --group <group-id> --url https://example.com/yolov8.onnx
```

--model and --version are required; --name defaults to `<model>-<version>`, and --strategy defaults to canary. The deployment needs target devices: pass --group (the CLI has no per-device option; over REST you can send `target_device_ids` instead), otherwise the control plane rejects it. REST: `POST /deployments` with JSON body. On openeye.sh, the dashboard's Fleet → Deployments page creates and tracks deployments (with per-device status) in your account.

### Rollout Strategies

The strategy (canary, rolling, blue_green, all_at_once) is stored on the deployment, but every strategy rolls out the same way: through the deployment's `rollout_stages`. The default plan is canary (10%), rollout-50 (50%), full (100%), with `min_wait_seconds` of 300 and 600 before leaving the first two stages. Each `fleet advance` queues deploy_model commands for the next stage's share of target devices. Send your own `rollout_stages` (name, percentage, min_wait_seconds) in the REST body to change the plan.

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

---
title: Commands & Heartbeats
---

### Heartbeat Protocol

Edge devices send heartbeats every 15 seconds via POST /heartbeats. The server responds with any pending commands. If 4 consecutive heartbeats are missed (>60s), the device is marked offline.

```json
// Device sends:
POST /heartbeats
X-Device-API-Key: dev_abc123

{
  "device_id": "d290f1ee-...",
  "resource_usage": {
    "cpu_percent": 45.2,
    "memory_percent": 62.1,
    "gpu_percent": 78.5,
    "gpu_temp_celsius": 68
  },
  "firmware_version": "1.2.0",
  "model_version": "1.0.0"
}
```

```json
// Server responds:
{
  "status": "ok",
  "server_time": "2026-03-15T10:30:00Z",
  "pending_commands": [
    {
      "id": "cmd-uuid",
      "command_type": "update_config",
      "payload": {"confidence_threshold": 0.4}
    }
  ]
}
```

### Command Queue

Commands are queued for devices and delivered via the heartbeat response. Available command types:

| Command | Description |
|---------|-------------|
| restart | Restart the device agent |
| update_config | Push new configuration |
| deploy_model | Deploy a model version |
| rollback_model | Rollback to previous model |
| ota_update | Initiate firmware update |
| decommission | Gracefully decommission device |
| collect_logs | Request device logs upload |

### POST /commands — Queue Command

```bash
curl -X POST https://api.openeye.ai/commands \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "d290f1ee-...",
    "command_type": "restart",
    "payload": {}
  }'
```

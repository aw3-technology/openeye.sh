---
title: Commands & Heartbeats
---

### Heartbeat Protocol

Edge devices running openeye fleet agent send heartbeats every 15 seconds (--interval) via `POST /heartbeats`, authenticated with their oek_ device key. The server responds with any pending commands.

```json
// Device sends:
POST /heartbeats
X-Device-API-Key: oek_abc123...

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

### CLI — Queue and Inspect Commands

```bash
openeye fleet config <device-id> '{"confidence_threshold": 0.4}'
openeye fleet restart <device-id>
openeye fleet batch restart --tag site=warehouse
openeye fleet commands --device <device-id> --status pending
```

Devices report completion with `POST /commands/{id}/device-complete` (device key); users can mark a command done with `POST /commands/{id}/complete`.

### From the openeye.sh Dashboard

The hosted dashboard can queue the same command types from a device's page; they are stored in your account's device_commands table with status pending. They reach a device only through a control plane connected to that database.

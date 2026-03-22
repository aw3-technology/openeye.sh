# Fleet Management Guide

End-to-end guide for managing edge AI devices at scale with `openeye fleet` — from registering devices through deploying models, monitoring health, and scheduling maintenance.

## Prerequisites

- OpenEye CLI installed (`pip install openeye-ai`)
- Fleet server running (`openeye serve` or cloud account)
- `OPENEYE_TOKEN` environment variable set

```bash
export OPENEYE_TOKEN=<your-token>
```

## 1. Register Devices

Register each edge device in the fleet:

```bash
openeye fleet register cam-front --type camera
openeye fleet register arm-1 --type robot
openeye fleet register gateway-west --type gateway
```

On success, the CLI prints the device ID and a one-time API key — save it immediately:

```
Device registered: a1b2c3d4-...
API Key (save now!): oek_xxxx...
```

| Flag | Description |
|------|-------------|
| `--type`, `-t` | Device type: `camera`, `robot`, `edge_node`, `gateway`, `drone` (default: `edge_node`) |

## 2. View & Filter Devices

List all devices:

```bash
openeye fleet ls
```

Filter by status or type:

```bash
openeye fleet ls --status offline
openeye fleet ls --type camera --status online
```

Get full details for a single device (JSON output):

```bash
openeye fleet info <device-id>
```

| Flag | Description |
|------|-------------|
| `--status`, `-s` | Filter: `online`, `offline`, `error`, `maintenance` |
| `--type`, `-t` | Filter: `camera`, `robot`, `edge_node`, `gateway`, `drone` |

## 3. Organize with Tags & Groups

### Tags

Attach key=value metadata to devices:

```bash
openeye fleet tag <device-id> location=warehouse-a zone=loading
```

### Groups

Create a logical group and add devices:

```bash
openeye fleet group-create "Warehouse A Cameras" --desc "All cameras in warehouse A"
openeye fleet group-add <group-id> <device-id>
```

List groups and view members:

```bash
openeye fleet groups
openeye fleet group-members <group-id>
```

Set auto-scaling policy on a group:

```bash
openeye fleet group-scaling <group-id> --enabled --min 2 --max 10 --target-cpu 70
```

## 4. Deploy Models

### Canary Deployment

Deploy to a small percentage first, then gradually roll out:

```bash
openeye fleet deploy \
  --model yolov8 \
  --version 2.1 \
  --strategy canary \
  --group <group-id>
```

When `--name` is omitted, it auto-generates as `<model>-<version>`.

### Rolling Deployment

Update devices one-by-one across the group:

```bash
openeye fleet deploy \
  --name "yolov8-rolling-v2" \
  --model yolov8 \
  --version 2.1 \
  --strategy rolling \
  --group <group-id>
```

### Monitor Deployments

```bash
openeye fleet deployments
openeye fleet deployments --status in_progress
```

### Advance or Pause

```bash
openeye fleet advance <deployment-id>
openeye fleet pause-deployment <deployment-id>
```

### Rollback

Roll back a deployment to the previous model version:

```bash
openeye fleet rollback <deployment-id>
```

| Flag | Description |
|------|-------------|
| `--model`, `-m` | Model ID to deploy |
| `--version`, `-v` | Model version string |
| `--strategy` | `canary`, `rolling`, `blue_green`, `all_at_once` (default: `canary`) |
| `--group`, `-g` | Target device group ID |
| `--name`, `-n` | Deployment name (optional, auto-generated if omitted) |
| `--url` | Direct URL to model weights file |

## 5. Monitor & Maintain

### Alerts

View unresolved alerts (default):

```bash
openeye fleet alerts
```

Filter by resolved state:

```bash
openeye fleet alerts --resolved true
```

Resolve an alert:

```bash
openeye fleet resolve-alert <alert-id>
```

### Device Commands

Restart a device:

```bash
openeye fleet restart <device-id>
```

View resource usage history:

```bash
openeye fleet resources <device-id> --limit 50
```

Send a batch command to devices matching a tag filter:

```bash
openeye fleet batch restart --tag zone=loading
```

### Maintenance Windows

Schedule a maintenance window:

```bash
openeye fleet maintenance-create \
  --name "Nightly Update" \
  --start "2025-06-01T02:00:00Z" \
  --end "2025-06-01T04:00:00Z" \
  --group <group-id>
```

Or target specific devices:

```bash
openeye fleet maintenance-create \
  --name "Firmware Patch" \
  --start "2025-06-01T02:00:00Z" \
  --end "2025-06-01T04:00:00Z" \
  --devices dev-1,dev-2,dev-3
```

List and manage maintenance windows:

```bash
openeye fleet maintenance-list
openeye fleet maintenance-list --active
openeye fleet maintenance-update <window-id> --start "2025-06-02T02:00:00Z"
openeye fleet maintenance-delete <window-id>
```

## 6. Decommission Devices

Remove a device from the fleet:

```bash
openeye fleet decommission <device-id> --reason "End of life" --wipe
```

| Flag | Description |
|------|-------------|
| `--reason`, `-r` | Reason for decommissioning |
| `--wipe` | Wipe device data after decommissioning |

## Putting It All Together

```
Register ─→ Tag ─→ Group ─→ Deploy ─→ Monitor ─→ Maintain
   │          │       │        │          │          │
   ▼          ▼       ▼        ▼          ▼          ▼
 fleet      fleet   fleet    fleet      fleet      fleet
register     tag   group-   deploy     alerts   maintenance-
              │   create      │          │       create
              ▼       │       ▼          ▼          │
           key=val    ▼    canary    resolve-       ▼
                   group-  rolling    alert     schedule
                    add   blue_green             windows
                           all_at_once
```

For more details on individual commands, see the [CLI Commands Reference](../cli/commands.md#fleet-management).

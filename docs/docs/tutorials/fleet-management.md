# Fleet Management Guide

End-to-end guide for managing edge AI devices at scale with `openeye fleet` — from registering devices through deploying models, monitoring health, and scheduling maintenance.

## Prerequisites

- OpenEye CLI installed (`pipx install openeye-sh`)
- A self-hosted fleet control plane (not `openeye serve`, which is the inference server)
- A Better Auth session token for a user in the control plane's database

### Run the control plane

The control plane is a FastAPI app in `backend/src/fleet/` that stores its data in Postgres (Neon or any Postgres). In short:

```bash
# 1. Create the tables (from the repo root)
psql "$DATABASE_URL" -f db/schema.sql     # or: npm run db:migrate

# 2. Start it
make install-backend
cd backend/src
DATABASE_URL="postgresql://...?sslmode=require" \
  uvicorn fleet.app:create_fleet_app --factory --host 0.0.0.0 --port 8001
```

All environment variables, auth details, and the schema notes are in [Backend Configuration → Fleet Control Plane](../backend/configuration.md#fleet-control-plane).

### Point the CLI at it

```bash
export OPENEYE_FLEET_URL=http://localhost:8001   # the default
export OPENEYE_TOKEN=<better-auth-session-token>
```

The control plane checks `OPENEYE_TOKEN` against the `session` table in its own database, so sign up through a copy of the website running on the same `DATABASE_URL` (for example `vercel dev`) and use that session's token.

!!! note "openeye.sh dashboard"
    The fleet pages on openeye.sh keep their records in openeye.sh's own database, not in your control plane. Use the CLI (or the API directly) to manage a self-hosted control plane.

## 1. Register Devices

Register each edge device in the fleet:

```bash
openeye fleet register cam-front --type camera
openeye fleet register arm-1 --type robot
openeye fleet register gateway-west --type gateway
```

On success, the CLI prints the device ID and a one-time API key — save it immediately. Only its SHA-256 hash is stored:

```
Device registered: a1b2c3d4-...
API Key (save now!): oek_xxxx...
```

### Run the device agent

On the device itself, start the agent with that key. It sends heartbeats (every 15 seconds by default) and authenticates with `X-Device-API-Key`:

```bash
export OPENEYE_DEVICE_API_KEY=oek_xxxx...
openeye fleet agent --device-id <device-id> --server http://<control-plane-host>:8001
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

View all alerts:

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

Commands are queued for the device agent to pick up. List what's pending:

```bash
openeye fleet commands
openeye fleet commands --device <device-id>
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

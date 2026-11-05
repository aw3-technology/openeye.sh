---
title: Device Management
---

These commands and REST routes are for a self-hosted fleet control plane (see Fleet Authentication). On openeye.sh, use the dashboard's Fleet → Devices page instead; it offers the same operations.

### Register a Device

```bash
openeye fleet register warehouse-cam-01 --type camera
```

REST: `POST /devices` with JSON body containing `name`, `device_type`, and optional `tags`. The response includes the device's `api_key` (oek_...) once; save it for openeye fleet agent. Device types: camera, robot, edge_node (default), gateway, drone.

### List Devices

```bash
openeye fleet ls
openeye fleet ls --status online
openeye fleet ls --type camera
```

REST: `GET /devices` with optional query parameters: `status`, `device_type`, `tag_key`, `tag_value`, `limit`, `offset`.

### Update Device Configuration

```bash
openeye fleet config <device-id> '{"danger_zone_m": 0.5}'
```

REST: `PUT /devices/{device_id}/config` with JSON body.

### Additional REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /devices/{id} | Get device details |
| PATCH | /devices/{id} | Update device metadata |
| PUT | /devices/{id}/tags | Set device tags |
| GET | /devices/{id}/resources | Get resource usage history |
| POST | /devices/{id}/restart | Restart device |
| DELETE | /devices/{id} | Decommission device |
| POST | /devices/batch | Batch operations on multiple devices |

### Other CLI Commands

```bash
openeye fleet info <device-id>
openeye fleet tag <device-id> site=warehouse floor=2
openeye fleet resources <device-id> --limit 50
openeye fleet restart <device-id>
openeye fleet decommission <device-id> --reason "replaced" --wipe
openeye fleet batch restart --tag site=warehouse
```

### Device Status

Devices report status via heartbeats (every 15 seconds by default). Possible statuses: `pending`, `online`, `offline`, `maintenance`, `error`, `decommissioned`. The control plane has offline detection for devices silent for more than 60 seconds (about 4 missed heartbeats), but nothing runs it on a schedule yet, so a device that stops reporting keeps its last status.

---
title: Device Management
---

### Register a Device

```bash
openeye fleet register --name "warehouse-cam-01" --type camera
```

REST: `POST /devices` with JSON body containing `name`, `device_type`, and optional `tags`.

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

### Device Status

Devices report status via heartbeats. If 4 consecutive heartbeats are missed (>60s), the device is marked offline. Possible statuses: `pending`, `online`, `offline`, `maintenance`, `error`, `decommissioned`.

---
title: Device Management
---

### Register a Device

```bash
openeye fleet register --name "warehouse-cam-01" --type camera
```

### List Devices

```bash
openeye fleet ls
openeye fleet ls --status online
openeye fleet ls --type camera
```

### Update Device Configuration

```bash
openeye fleet config <device-id> '{"danger_zone_m": 0.5}'
```

### Device Status

Devices report status via heartbeats. If 4 consecutive heartbeats are missed (>60s), the device is marked offline. Possible statuses: `pending`, `online`, `offline`, `maintenance`.

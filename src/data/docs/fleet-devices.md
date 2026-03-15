---
title: Device Endpoints
---

### POST /devices — Register Device

```bash
curl -X POST https://api.openeye.ai/devices \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "warehouse-cam-01",
    "device_type": "camera",
    "tags": {"location": "warehouse-a", "floor": "1"},
    "firmware_version": "1.2.0"
  }'
```

```json
{
  "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "name": "warehouse-cam-01",
  "device_type": "camera",
  "status": "pending",
  "api_key": "dev_abc123...",
  "tags": {"location": "warehouse-a", "floor": "1"},
  "registered_at": "2026-03-15T10:00:00Z"
}
```

> [!warning] The api_key is only returned once at registration. Store it securely on the device.

### GET /devices — List Devices

```bash
# List all devices
curl https://api.openeye.ai/devices \
  -H "Authorization: Bearer <jwt>"

# Filter by status and type
curl "https://api.openeye.ai/devices?status=online&device_type=camera" \
  -H "Authorization: Bearer <jwt>"
```

### PATCH /devices/:id — Update Device

```bash
curl -X PATCH https://api.openeye.ai/devices/<id> \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "warehouse-cam-01-updated", "tags": {"location": "warehouse-b"}}'
```

### DELETE /devices/:id — Decommission Device

```bash
curl -X DELETE https://api.openeye.ai/devices/<id> \
  -H "Authorization: Bearer <jwt>"
```

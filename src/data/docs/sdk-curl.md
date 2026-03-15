---
title: cURL
---

### Object Detection

```bash
curl -X POST https://api.openeye.ai/v1/detect \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@photo.jpg" \
  -F "confidence=0.3"
```

### Depth Estimation

```bash
curl -X POST https://api.openeye.ai/v1/depth \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@scene.jpg" \
  -o depth_result.json
```

### Scene Description

```bash
curl -X POST https://api.openeye.ai/v1/describe \
  -H "X-API-Key: oe_live_abc123" \
  -F "file=@warehouse.jpg" \
  -F "prompt=How many boxes are on the shelves?"
```

### List Models

```bash
curl https://api.openeye.ai/v1/models \
  -H "X-API-Key: oe_live_abc123"
```

### Check Usage

```bash
curl "https://api.openeye.ai/v1/usage?days=7" \
  -H "X-API-Key: oe_live_abc123"
```

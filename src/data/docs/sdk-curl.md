---
title: cURL
---

### Hosted API

```bash
export OPENEYE_API_KEY=oe_your_key_here

curl -X POST https://openeye.sh/v1/detect \
  -H "Authorization: Bearer $OPENEYE_API_KEY" \
  -F "file=@photo.jpg" -F "confidence=0.3"

curl https://openeye.sh/v1/models -H "Authorization: Bearer $OPENEYE_API_KEY"
curl "https://openeye.sh/v1/usage?days=7" -H "Authorization: Bearer $OPENEYE_API_KEY"
```

Add -i to see the X-RateLimit-Limit and X-RateLimit-Remaining headers.

### Object Detection (self-hosted)

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

### Pretty-print with jq

```bash
curl -s -X POST http://localhost:8000/predict -F "file=@photo.jpg" | jq '.objects[] | {label, confidence}'
```

### Depth Estimation

```bash
openeye run depth-anything scene.jpg --output depth.json
```

### Open-Vocabulary Detection

```bash
openeye run grounding-dino image.jpg --prompt "red cup"
```

### List Models

```bash
openeye list
```

---
title: cURL
---

### Object Detection

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

### Pretty-print with jq

```bash
openeye run yolov8 photo.jpg --pretty
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

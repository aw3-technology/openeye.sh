---
title: openeye run
---

Run inference on a single image and print JSON results. Supports stdin piping for chaining commands.

```bash
openeye run yolov8 photo.jpg
openeye run yolov8 photo.jpg --pretty
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
openeye run yolov8 photo.jpg --visualize
openeye run yolov8 photo.jpg --backend onnx
```

### Options

| Flag | Description |
|------|-------------|
| --prompt, -p <text> | Text prompt for open-vocabulary models (e.g. grounding-dino) |
| --output, -o <path> | Write JSON results to a file instead of stdout |
| --pretty | Pretty-print JSON output |
| --visualize | Save an annotated image with bounding boxes or depth map |
| --backend, -b <name> | Use a specific runtime backend (onnx, tensorrt) |
| --variant <name> | Use a specific model variant |

### Unix Pipeline

Output is JSON by default, making it composable with standard tools:

```bash
openeye run yolov8 photo.jpg | jq '.objects[] | {label, confidence}'
openeye run yolov8 photo.jpg | jq '.objects | length'
```

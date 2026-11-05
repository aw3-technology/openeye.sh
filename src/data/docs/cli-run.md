---
title: openeye run
---

Run inference on an image, a directory of images, or stdin, and print JSON results. The model must be pulled first.

```bash
openeye run yolov8 photo.jpg
openeye run yolov8 photo.jpg --pretty
openeye run yolov8 photo.jpg --confidence 0.5
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
openeye run yolov8 photo.jpg --visualize
openeye run yolov8 photo.jpg --backend onnx
openeye run yolov8 ./images/ -o results.json
```

### Arguments

| Argument | Description |
|----------|-------------|
| MODEL | Model name (e.g. yolov8) |
| IMAGE | Image path, directory, or - for stdin. Omit it when piping into the command |

### Options

| Flag | Description |
|------|-------------|
| --prompt, -p <text> | Text prompt for open-vocabulary models (e.g. grounding-dino) |
| --confidence, -c <float> | Minimum confidence threshold (0.0–1.0) |
| --output, -o <path> | Write JSON results to a file (indented) |
| --pretty | Print a human-readable, colored summary to stderr; JSON still goes to stdout |
| --visualize | Save an annotated image with bounding boxes or depth map |
| --backend, -b <name> | Runtime backend: onnx or tensorrt (selects that variant) |
| --variant <name> | Use a specific model variant |

A directory runs every image in it and prints a JSON array. Images that fail are skipped with a warning.

### Unix Pipeline

Output is a single line of JSON on stdout, so it composes with standard tools:

```bash
openeye run yolov8 photo.jpg | jq '.objects[] | {label, confidence}'
openeye run yolov8 photo.jpg | jq '.objects | length'
cat photo.jpg | openeye run yolov8 -
```

Piping one run into another merges their results, for example detections plus a depth map:

```bash
openeye run yolov8 photo.jpg | openeye run depth-anything -
```

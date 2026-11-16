---
title: "How to Run YOLO Locally from the Command Line (Mac, Linux, Windows)"
excerpt: "A practical guide to running YOLO object detection on your own machine: install, detect objects in an image, batch a folder, pipe JSON into jq, use Apple Silicon or NVIDIA GPUs, and serve it as an API — without writing any Python."
date: "2026-11-15"
author: "OpenEye Team"
category: "Tutorial"
readTime: "7 min read"
---

You don't need a notebook, a training pipeline, or a cloud account to run YOLO. With OpenEye, object detection is a terminal command, like `ollama run` for vision models.

## Install

OpenEye needs Python 3.12 or newer. Install it with pipx so it gets its own environment:

```bash
pipx install "openeye-sh[yolo]"
```

The `yolo` extra pulls in the YOLO backend. Quote the brackets in zsh and fish.

## Pull the model

```bash
openeye pull yolov8
```

Weights are downloaded once and cached. `openeye list` shows what's installed. The [model registry](/models) lists everything else you can pull, including YOLO26, RF-DETR, Grounding DINO, Depth Anything V2, and SAM 2.

## Detect objects in an image

```bash
openeye run yolov8 photo.jpg --pretty
```

`--pretty` prints a readable summary to stderr. Stdout always gets a single line of JSON (abbreviated here):

```json
{"model":"yolov8","task":"detection","objects":[{"label":"dog","confidence":0.92,"bbox":{"x":0.12,"y":0.30,"w":0.41,"h":0.55}}],"inference_ms":41.7}
```

Useful flags:

```bash
openeye run yolov8 photo.jpg --confidence 0.5   # drop low-confidence detections
openeye run yolov8 photo.jpg --visualize        # save an annotated image with boxes
openeye run yolov8 photo.jpg --backend onnx     # use the ONNX variant
```

## Batch a whole folder

Point it at a directory and it prints a JSON array, one result per image:

```bash
openeye run yolov8 ./images/ -o results.json
```

Images that fail to load are skipped with a warning, so one corrupt file doesn't stop a large batch.

## Compose it with Unix tools

Because the output is JSON, the usual tools just work:

```bash
# Labels and scores only
openeye run yolov8 photo.jpg | jq '.objects[] | {label, confidence}'

# Count people in every image in a folder
openeye run yolov8 ./frames/ | jq '[.[] | [.objects[] | select(.label=="person")] | length]'

# Read from stdin
curl -s https://example.com/street.jpg | openeye run yolov8 -
```

You can also pipe one model into another. This merges detections with a depth map, so you know what's in the frame and how far away it is:

```bash
openeye run yolov8 photo.jpg | openeye run depth-anything -
```

## Use your GPU

OpenEye picks the fastest device it finds:

- **Apple Silicon:** Metal (MPS) is used automatically for YOLO and Depth Anything.
- **NVIDIA:** CUDA is used when a CUDA build of PyTorch is installed. For maximum throughput, `--backend tensorrt` selects the TensorRT variant (install the `tensorrt` extra).
- **CPU:** the default fallback. The ONNX backend (`--backend onnx`, `onnx` extra) is often the fastest CPU option.

To see what a model actually does on your hardware:

```bash
openeye bench yolov8
```

## Turn it into an API

When you're ready to call it from another program, serve it:

```bash
openeye serve yolov8
```

That starts a REST and WebSocket server on `http://localhost:8000`, with the same JSON output. See the [REST endpoints](/docs/rest-endpoints) and [WebSocket protocol](/docs/ws-protocol) docs for request formats.

## Live camera

With the `camera` extra installed, run detections on a webcam in real time:

```bash
openeye watch --models yolov8
```

## Don't want to install anything?

The hosted API runs YOLOv8 detection for you at `https://openeye.sh/v1/detect`. Grab a key from the dashboard and follow the [hosted quickstart](/docs/quickstart).

## Next steps

- [Installation guide](/docs/installation), including every extra
- [`openeye run` reference](/docs/cli-run)
- [Give Claude vision with MCP](/blog/give-claude-vision-with-mcp): let an AI agent run these models for you
- [Source on GitHub](https://github.com/aw3-technology/openeye.sh). Stars and issues help.

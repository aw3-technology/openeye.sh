---
title: Installation
---

There are two ways to use OpenEye:

- Hosted API — send images to https://openeye.sh/v1 with an API key. Nothing to install. See "Path B: Hosted API" in the Quickstart and the Hosted API section.
- Self-hosted CLI — install openeye-sh and run models on your own machine, free. The rest of this page covers that.

### Requirements

- Python 3.12 or later
- pipx (recommended): https://pipx.pypa.io/

### Install from PyPI

```bash
pipx install openeye-sh
```

This installs two commands: openeye (the CLI) and openeye-mcp (an MCP server over stdio; needs the mcp extra).

### Optional Dependencies

Install extras for specific model backends. Quote the brackets in zsh and fish.

```bash
# YOLO object detection (yolov8, yolo26)
pipx install "openeye-sh[yolo]"

# Depth estimation (depth-anything)
pipx install "openeye-sh[depth]"

# Grounding DINO (open-vocabulary detection)
pipx install "openeye-sh[grounding]"

# YOLO + depth + grounding + VLM client + OpenCV
pipx install "openeye-sh[all]"

# Camera support (OpenCV)
pipx install "openeye-sh[camera]"

# MCP server for agents (openeye-mcp)
pipx install "openeye-sh[mcp]"
```

| Extra | Adds |
|-------|------|
| yolo | Ultralytics (yolov8, yolo26) |
| depth | Transformers + torch (Depth Anything V2) |
| grounding | Transformers + torch (Grounding DINO) |
| sam | SAM 2 |
| rfdetr | RF-DETR |
| smolvla | LeRobot (SmolVLA) |
| onnx, onnx-gpu | ONNX Runtime (CPU or GPU) |
| tensorrt | TensorRT + ONNX Runtime GPU |
| vlm | OpenAI-compatible client for VLM providers |
| cloud | boto3 + google-cloud-storage (s3:// and gs:// datasets) |
| camera | OpenCV |
| mcp | MCP server (openeye-mcp) |
| all | yolo, depth, grounding, vlm, and OpenCV |

To add an extra to an existing pipx install, reinstall with --force:

```bash
pipx install "openeye-sh[depth]" --force
```

### Platform Notes

- macOS — MPS (Apple Silicon GPU) is supported for YOLO and Depth Anything
- Linux — CUDA is supported when torch is installed with CUDA
- CPU — All models work on CPU (slower)

### Verify Installation

```bash
openeye --version
openeye list
```

openeye docs prints the full command reference; openeye docs --json gives a machine-readable version for agents.

### Development Install

```bash
git clone https://github.com/aw3-technology/openeye.sh.git
cd openeye.sh/cli
pip install -e ".[all]" --group dev
```

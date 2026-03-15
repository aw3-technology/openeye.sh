---
title: Installation
---

### Requirements

- Python 3.10 or later
- pip (latest recommended)

### Install from PyPI

```bash
pip install openeye-ai
```

### Optional Dependencies

Install extras for specific model backends:

```bash
# YOLO object detection
pip install "openeye-ai[yolo]"

# Depth estimation
pip install "openeye-ai[depth]"

# Grounding DINO (open-vocabulary detection)
pip install "openeye-ai[grounding]"

# Everything
pip install "openeye-ai[all]"

# Camera support (OpenCV)
pip install "openeye-ai[camera]"
```

### Platform Notes

- macOS — MPS (Apple Silicon GPU) is supported for YOLO and Depth Anything
- Linux — CUDA is supported when torch is installed with CUDA
- CPU — All models work on CPU (slower)

### Verify Installation

```bash
openeye --help
openeye list
```

### Development Install

```bash
git clone https://github.com/OpenEye/perceptify-the-world.git
cd perceptify-the-world/cli
pip install -e ".[all]" --group dev
```

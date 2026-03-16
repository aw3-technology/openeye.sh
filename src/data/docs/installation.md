---
title: Installation
---

### Requirements

- Python 3.10 or later
- [pipx](https://pipx.pypa.io/) (recommended)

### Install from PyPI

```bash
pipx install openeye-sh
```

### Optional Dependencies

Install extras for specific model backends:

```bash
# YOLO object detection
pipx install "openeye-sh[yolo]"

# Depth estimation
pipx install "openeye-sh[depth]"

# Grounding DINO (open-vocabulary detection)
pipx install "openeye-sh[grounding]"

# Everything
pipx install "openeye-sh[all]"

# Camera support (OpenCV)
pipx install "openeye-sh[camera]"
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
git clone https://github.com/aw3-technology/openeye.sh.git
cd openeye.sh/cli
pip install -e ".[all]" --group dev
```

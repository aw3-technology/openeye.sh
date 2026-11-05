# Installation

## Requirements

- Python 3.12 or later
- [pipx](https://pipx.pypa.io/) (recommended)

## Install from PyPI

```bash
pipx install openeye-sh
```

The PyPI package is `openeye-sh`; it installs the `openeye` command and the `openeye-mcp` MCP server entry point.

!!! tip "Only need the hosted API?"
    The base install is enough for `openeye api ...` against `https://openeye.sh/v1`. No model weights or extras are needed. See [Hosted API quickstart](quickstart.md#hosted-api-quickstart).

## Optional Dependencies

Install extras for specific model backends:

```bash
# YOLO object detection
pipx install "openeye-sh[yolo]"

# Depth estimation
pipx install "openeye-sh[depth]"

# Grounding DINO (open-vocabulary detection)
pipx install "openeye-sh[grounding]"

# Segment Anything 2, RF-DETR, SmolVLA
pipx install "openeye-sh[sam]"
pipx install "openeye-sh[rfdetr]"
pipx install "openeye-sh[smolvla]"

# ONNX Runtime / TensorRT backends
pipx install "openeye-sh[onnx]"        # or [onnx-gpu]
pipx install "openeye-sh[tensorrt]"

# VLM client, cloud storage, MCP server
pipx install "openeye-sh[vlm]"
pipx install "openeye-sh[cloud]"
pipx install "openeye-sh[mcp]"

# Camera support (OpenCV)
pipx install "openeye-sh[camera]"

# yolo + depth + grounding + vlm + OpenCV
pipx install "openeye-sh[all]"
```

Quote the brackets in zsh and fish. To add an extra to an existing pipx install, re-run with `--force`.

## Platform Notes

- **macOS**: MPS (Apple Silicon GPU) is supported for YOLO and Depth Anything
- **Linux**: CUDA is supported when torch is installed with CUDA
- **CPU**: All models work on CPU (slower)

## Verify Installation

```bash
openeye --help
openeye list
```

## Development Install

```bash
git clone https://github.com/aw3-technology/openeye.sh.git
cd openeye.sh/cli
pip install -e ".[all]" --group dev
```

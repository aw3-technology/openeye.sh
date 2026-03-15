# Installation

## Requirements

- Python 3.10 or later
- pip (latest recommended)

## Install from PyPI

```bash
pip install openeye-ai
```

## Optional Dependencies

Install extras for specific model backends and features:

```bash
# Object detection
pip install "openeye-ai[yolo]"         # YOLOv8 (ultralytics)
pip install "openeye-ai[grounding]"    # Grounding DINO (open-vocabulary)
pip install "openeye-ai[rfdetr]"       # RF-DETR detection

# Depth & segmentation
pip install "openeye-ai[depth]"        # Depth Anything V2
pip install "openeye-ai[sam]"          # Segment Anything 2

# Robotics
pip install "openeye-ai[smolvla]"      # SmolVLA (lerobot)
pip install "openeye-ai[robotics]"     # gRPC + MQTT for robot integration

# Model runtimes
pip install "openeye-ai[onnx]"         # ONNX Runtime (CPU)
pip install "openeye-ai[onnx-gpu]"     # ONNX Runtime (GPU)
pip install "openeye-ai[tensorrt]"     # TensorRT

# Camera & desktop
pip install "openeye-ai[camera]"       # OpenCV for camera
pip install "openeye-ai[desktop]"      # Screen capture (mss)

# Tools
pip install "openeye-ai[mcp]"          # MCP server for desktop vision
pip install "openeye-ai[debug]"        # Debugging tools (playwright, scikit-image)

# Everything (YOLO + depth + grounding + OpenCV)
pip install "openeye-ai[all]"
```

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
git clone https://github.com/OpenEye/perceptify-the-world.git
cd perceptify-the-world/cli
pip install -e ".[all]" --group dev
```

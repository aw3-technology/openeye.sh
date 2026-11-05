---
title: openeye pull
---

Download model weights from Hugging Face Hub to ~/.openeye/models/<model>/.

```bash
openeye pull yolov8
openeye pull depth-anything
openeye pull grounding-dino
openeye pull yolov8 --quantized
openeye pull --all
```

### Arguments

| Argument | Description |
|----------|-------------|
| MODEL | Registry key to pull (see openeye list). Optional when --all is given |

### Options

| Flag | Description |
|------|-------------|
| --all | Pull every model in the registry |
| --variant <name> | Pull a specific variant (yolov8 has a quantized variant, yolov8n_int8.onnx) |
| --quantized | Shortcut for --variant quantized |
| --force | Re-download even if already present |

### Registry

| Key | Task | Weights |
|-----|------|---------|
| yolov8 | detection | ultralytics/yolov8 (yolov8n.pt) |
| yolo26 | detection | ultralytics/yolo11 (yolo11n.pt for now) |
| depth-anything | depth | depth-anything/Depth-Anything-V2-Small-hf |
| grounding-dino | detection (open-vocabulary) | IDEA-Research/grounding-dino-tiny |
| sam2 | segmentation | facebook/sam2-hiera-small |
| rfdetr | detection | rfdetr/rfdetr-base |
| smolvla | vla (vision-language-action) | lerobot/smolvla_base |

Running a model also needs its Python extra, for example pipx install "openeye-sh[depth]" --force; the CLI tells you which one if it's missing. To delete downloaded weights, run openeye remove <model> (see Model Management).

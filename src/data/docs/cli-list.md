---
title: openeye list
---

List every model in the registry and whether it's downloaded. Takes no options.

```bash
openeye list
```

The table has one row per model:

| Column | Shows |
|--------|-------|
| Model | Registry key to pass to pull, run, serve, and bench |
| Task | detection, depth, segmentation, or vla |
| Description | Short description from the registry |
| Size | Download size in MB |
| Hardware | Supported hardware (CPU, CUDA, MPS, ...) |
| Variants | Extra variants (e.g. quantized for yolov8); green when downloaded |
| Status | downloaded, or available to pull |

The registry ships with the CLI (models.yaml in the package): yolov8, depth-anything, grounding-dino, yolo26, sam2, rfdetr, and smolvla. Use openeye update-registry to merge in models added upstream, and add-model or register-adapter to add your own (see Model Management).

For the models on the hosted API, run openeye api models instead.

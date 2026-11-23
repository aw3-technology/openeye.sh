---
title: openeye list
---

List every model in the registry and whether it's downloaded.

```bash
openeye list
openeye list --json
```

--json prints the registry as a JSON array instead (key, name, task, description, size_mb, hardware, downloaded, variants) for scripts and agents.

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

The built-in registry ships with the CLI (models.yaml in the package): yolov8, depth-anything, grounding-dino, yolo26, sam2, rfdetr, and smolvla. Use openeye update-registry to merge in models added upstream, and add-model or register-adapter to add your own; both are saved to ~/.openeye/custom_models.yaml and listed alongside the built-ins (see Model Management).

For the models on the hosted API, run openeye api models instead.

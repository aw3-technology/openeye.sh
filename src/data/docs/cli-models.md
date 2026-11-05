---
title: Model Management
---

Commands for removing weights and extending the model registry. See openeye pull and openeye list for downloading and browsing.

### openeye remove

Delete downloaded weights from ~/.openeye/models/.

```bash
openeye remove yolov8
```

### openeye add-model

Add a model to the registry.

```bash
openeye add-model my-detector --name "My Detector" --task detection \
  --adapter onnx_generic --hf-repo me/my-detector --filename model.onnx --size-mb 12
```

| Flag | Description |
|------|-------------|
| KEY | Registry key (required) |
| --name <text> | Display name (defaults to the key) |
| --task <task> | detection, depth, segmentation, classification, or embedding |
| --adapter <key or path> | Built-in adapter key (e.g. onnx_generic, tensorrt_generic) or a path to a .py file |
| --hf-repo <id> | Hugging Face repo ID to pull from |
| --filename <name> | Weights filename in that repo |
| --size-mb <n> | Size in MB, shown by openeye list |
| --description <text> | Description |

### openeye register-adapter

Register a custom adapter file and add a registry entry for it in one step.

```bash
openeye register-adapter my-model ./my_adapter.py --name "My Model" --task detection
```

| Flag | Description |
|------|-------------|
| KEY | Registry key (required) |
| ADAPTER_PATH | Path to the adapter .py file (required); it must define a class named Adapter that subclasses ModelAdapter |
| --name <text> | Display name |
| --task <task> | Task type |
| --description <text> | Description |

See Model Adapters for how to write one.

### openeye update-registry

Fetch the latest registry from the OpenEye repository (cli/openeye_ai/models.yaml on main) and merge in models you don't have yet.

```bash
openeye update-registry
```

add-model, register-adapter, and update-registry all edit the models.yaml installed with the CLI, so reinstalling or upgrading the package resets them.

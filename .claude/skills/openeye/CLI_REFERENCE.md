# OpenEye CLI Reference

Built with Typer. Entry point: `openeye = "openeye_ai.cli:app"` (pyproject.toml).

## Top-Level Commands

### `openeye list`
Show available and downloaded models.
```
openeye list
```

### `openeye pull [MODEL]`
Download model weights to `~/.openeye/models/`.
```
openeye pull [MODEL] [OPTIONS]

Arguments:
  MODEL              Model name (optional — interactive picker if omitted)

Options:
  --all              Pull all models
  --variant TEXT     Download specific variant (e.g. "quantized")
  --quantized        Shorthand for --variant quantized
  --force            Re-download even if exists
```

### `openeye run MODEL [IMAGE]`
Run inference on an image.
```
openeye run MODEL [IMAGE] [OPTIONS]

Arguments:
  MODEL              Model name (required)
  IMAGE              Image file path (optional — uses camera if omitted)

Options:
  -p, --prompt TEXT     Prompt for open-vocab models (e.g. grounding_dino)
  --pretty              Pretty-print JSON output
  -o, --output PATH     Save result JSON to file
  --visualize           Show annotated image
  -b, --backend TEXT    Force backend (cpu/cuda/mps)
  --variant TEXT        Use model variant
```

### `openeye remove MODEL`
Delete downloaded model weights.
```
openeye remove MODEL
```

### `openeye bench MODEL`
Benchmark model inference speed.
```
openeye bench MODEL [OPTIONS]

Options:
  --variant TEXT     Model variant
  --warmup INT      Warmup iterations (default: 3)
  --runs INT        Benchmark iterations (default: 10)
  --width INT       Input width (default: 640)
  --height INT      Input height (default: 480)
```

### `openeye serve MODEL`
Start FastAPI server with REST, WebSocket, and dashboard.
```
openeye serve MODEL [OPTIONS]

Options:
  --host TEXT       Bind address (default: 0.0.0.0)
  --port INT        Port (default: 8000)
  --demo            Demo mode: warm up model for zero cold-start
```

### `openeye watch`
Live camera feed with real-time detections. Requires `opencv-python`.
```
openeye watch [OPTIONS]

Options:
  -m, --models TEXT    Comma-separated model names (default: yolov8)
  -c, --camera INT     Camera device index (default: 0)
  --demo               Demo mode: warm up models for zero cold-start
```

### `openeye add-model KEY`
Add a new model entry to the registry.
```
openeye add-model KEY [OPTIONS]

Options:
  --name TEXT          Display name
  --task TEXT          Task type (detection/depth/segmentation/classification/embedding)
  --adapter TEXT       Adapter key or path
  --hf-repo TEXT       HuggingFace repo ID
  --filename TEXT      Model filename
  --size-mb INT        Size in MB
  --description TEXT   Description
```

### `openeye register-adapter KEY ADAPTER_PATH`
Register a custom adapter Python file and add to registry.
```
openeye register-adapter KEY ADAPTER_PATH [OPTIONS]

Options:
  --name TEXT          Display name
  --task TEXT          Task type
  --description TEXT   Description
```

### `openeye update-registry`
Fetch remote registry and merge new models.

### `openeye --version / -v`
Show version and exit.

---

## Config Subcommands

### `openeye config set KEY VALUE`
Set a configuration value in `~/.openeye/config.yaml`.

### `openeye config get KEY`
Get a configuration value.

---

## Fleet Subcommands

All fleet commands require `OPENEYE_FLEET_URL` (default `http://localhost:8001`) and `OPENEYE_TOKEN`.

### Device Management

```
openeye fleet register NAME [--type/-t TYPE]
  Register device. Types: camera, robot, edge_node (default), gateway, drone

openeye fleet ls [--status/-s STATUS] [--type/-t TYPE]
  List devices. Status: pending, online, offline, maintenance, error, decommissioned

openeye fleet info DEVICE_ID
  Show device details (JSON)

openeye fleet restart DEVICE_ID
  Send restart command

openeye fleet decommission DEVICE_ID [--reason/-r TEXT] [--wipe]
  Decommission device, optionally wipe data

openeye fleet tag DEVICE_ID TAGS...
  Set tags (key=value pairs, e.g. "location=warehouse floor=2")

openeye fleet config DEVICE_ID CONFIG_JSON
  Set config overrides (JSON string)
```

### Deployments

```
openeye fleet deploy [OPTIONS]
  --name/-n TEXT        Deployment name
  --model/-m TEXT       Model name
  --version/-v TEXT     Model version
  --strategy TEXT       canary | rolling | blue_green | all_at_once
  --group/-g TEXT       Target device group ID
  --url TEXT            Model download URL

openeye fleet rollback DEPLOYMENT_ID
  Rollback to previous version

openeye fleet deployments [--status/-s STATUS]
  List deployments. Status: pending, in_progress, paused, completed, rolling_back, rolled_back, failed
```

### Groups & Alerts

```
openeye fleet group-create NAME [--desc/-d TEXT]
  Create device group

openeye fleet groups
  List all groups

openeye fleet alerts [--resolved]
  List alerts (default: unresolved only)
```

### Device Agent

```
openeye fleet agent [OPTIONS]
  --device-id/-d TEXT    Device ID
  --api-key/-k TEXT      API key (or OPENEYE_DEVICE_API_KEY env)
  --server/-s TEXT       Fleet server URL
  --interval INT         Heartbeat interval in seconds
```

---

## MLOps Subcommands

### Model Registry & Lifecycle

```
openeye mlops upload FILE [OPTIONS]
  -n, --name TEXT        Model display name
  -k, --key TEXT         Registry key
  -f, --format TEXT      onnx | torchscript | safetensors
  -t, --task TEXT        Task type
  --author TEXT          Author name
  -d, --description TEXT Description
  --adapter TEXT         Adapter to use

openeye mlops registry
  List all models with version history

openeye mlops versions MODEL_KEY
  List all versions of a model

openeye mlops promote MODEL_KEY VERSION STAGE [--requester TEXT] [--reason TEXT]
  Promote version (STAGE is positional). Stages: staging, production, archived
  --requester defaults to "cli-user"
```

### A/B Testing & Shadow Mode

```
openeye mlops ab-test MODEL_KEY [OPTIONS]
  --a TEXT               Version A
  --b TEXT               Version B
  --name TEXT            Test name
  --split FLOAT          Traffic split (0-1, default 0.5)
  --max-samples INT      Max samples before auto-conclude

openeye mlops ab-status [MODEL_KEY]
  Show A/B test status and metrics

openeye mlops shadow MODEL_KEY [OPTIONS]
  --prod TEXT            Production version
  --shadow TEXT          Shadow version
  --sample-rate FLOAT    Sampling rate (0-1)
  --max-samples INT      Max samples

openeye mlops shadow-status [MODEL_KEY]
  Show shadow deployment comparison metrics
```

### Batch & Benchmarking

```
openeye mlops batch MODEL_KEY VERSION INPUT_PATH OUTPUT_PATH [OPTIONS]
  --batch-size INT       Batch size (default varies)
  --workers INT          Parallel workers
  --format TEXT          Output format

openeye mlops benchmark MODEL [--runs INT] [--width INT] [--height INT]
  Cross-hardware benchmark matrix
```

### Export & Validation

```
openeye mlops export MODEL_KEY VERSION TARGET_FORMAT [OPTIONS]
  Target: onnx | tensorrt | coreml
  -o, --output PATH      Output path
  --quantize             Enable quantization

openeye mlops validate MODEL VERSION TEST_ID
  Run validation test against model version
```

### Lineage, Retraining & Feedback

```
openeye mlops lineage MODEL_KEY VERSION
  Show model provenance/lineage

openeye mlops retrain PIPELINE_NAME [--by TEXT]
  Trigger retraining pipeline

openeye mlops annotate MODEL_KEY VERSION IMAGE [OPTIONS]
  --label TEXT           Correct label
  --type TEXT            false_positive | false_negative | misclassification | wrong_bbox | low_confidence
  --predicted TEXT       What model predicted
  --annotator TEXT       Who annotated
  --notes TEXT           Notes

openeye mlops feedback MODEL_KEY OUTPUT
  Generate correction dataset from annotations
```

---

## Pip Install Extras

```bash
pipx install "openeye-sh[yolo]"        # YOLOv8 (ultralytics>=8.2)
pipx install "openeye-sh[depth]"       # Depth Anything (transformers, torch, accelerate)
pipx install "openeye-sh[grounding]"   # Grounding DINO (transformers, torch, accelerate)
pipx install "openeye-sh[onnx]"        # ONNX Runtime (onnxruntime>=1.17)
pipx install "openeye-sh[onnx-gpu]"    # ONNX with GPU (onnxruntime-gpu>=1.17)
pipx install "openeye-sh[tensorrt]"    # TensorRT (tensorrt>=10.0)
pipx install "openeye-sh[camera]"      # Live camera (opencv-python>=4.9)
pipx install "openeye-sh[all]"         # Everything
```

## File Paths

| File | Purpose |
|------|---------|
| `~/.openeye/` | Home directory |
| `~/.openeye/models/` | Downloaded model weights |
| `~/.openeye/config.yaml` | User configuration |
| `cli/openeye_ai/models.yaml` | Bundled model registry |
| `cli/openeye_ai/cli.py` | Main CLI (1344 lines) |
| `cli/openeye_ai/fleet_cli.py` | Fleet CLI (395 lines) |
| `cli/openeye_ai/registry.py` | Model registry & adapter resolution |
| `cli/openeye_ai/adapters/base.py` | ModelAdapter ABC |
| `cli/openeye_ai/server/app.py` | FastAPI inference server |

# CLI Commands

The `openeye` CLI is built with Typer. Install via `pip install openeye-ai`.

## Model Management

### `openeye list`

List all registered models and their download status.

```bash
openeye list
```

### `openeye pull [MODEL]`

Download model weights from HuggingFace Hub.

```bash
openeye pull yolov8
openeye pull depth-anything
openeye pull grounding-dino
```

**Options:**

- `--all` — Pull all models
- `--variant <name>` — Pull a specific variant (e.g., `quantized`)
- `--quantized` — Shorthand for `--variant quantized`
- `--force` — Re-download even if already present

### `openeye remove <model>`

Delete downloaded model weights.

```bash
openeye remove yolov8
```

### `openeye add-model <key>`

Manually register a new model entry in the registry.

```bash
openeye add-model my-model --name "My Model" --task detection --adapter ./my_adapter.py
```

**Options:**

- `--name <text>` — Display name
- `--task <text>` — Task type (detection, depth, segmentation, classification, embedding)
- `--adapter <text>` — Adapter key or path to custom adapter file
- `--hf-repo <text>` — HuggingFace repo ID
- `--filename <text>` — Model filename
- `--size-mb <int>` — Size in MB
- `--description <text>` — Description

### `openeye register-adapter <key> <adapter_path>`

Register a custom adapter Python file.

```bash
openeye register-adapter my-model ./my_adapter.py --task detection
```

**Options:**

- `--name <text>` — Display name
- `--task <text>` — Task type
- `--description <text>` — Description

### `openeye update-registry`

Fetch remote registry and merge new models.

## Inference

### `openeye run <model> [image]`

Run inference on a single image and print JSON results.

```bash
openeye run yolov8 photo.jpg
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
```

**Options:**

- `-p, --prompt <text>` — Text prompt for open-vocabulary models
- `--pretty` — Pretty-print JSON output
- `-o, --output <path>` — Save result JSON to file
- `--visualize` — Show annotated image
- `-b, --backend <text>` — Force backend (cpu, cuda, mps)
- `--variant <text>` — Use model variant

### `openeye bench <model>`

Benchmark model inference speed.

```bash
openeye bench yolov8 --runs 20
```

**Options:**

- `--variant <text>` — Model variant
- `--warmup <int>` — Warmup iterations (default: 3)
- `--runs <int>` — Benchmark iterations (default: 10)
- `--width <int>` — Input width (default: 640)
- `--height <int>` — Input height (default: 480)

### `openeye serve <model>`

Start a FastAPI inference server with REST, WebSocket, and browser dashboard.

```bash
openeye serve yolov8
openeye serve yolov8 --port 9000
```

**Options:**

- `--host <addr>` — Bind address (default: `0.0.0.0`)
- `--port <num>` — Port number (default: `8000`)
- `--demo` — Demo mode: warm up model for zero cold-start

### `openeye watch`

Live camera feed with real-time detections.

```bash
openeye watch
openeye watch -m yolov8,depth_anything
```

**Options:**

- `-m, --models <text>` — Comma-separated model names (default: yolov8)
- `-c, --camera <int>` — Camera device index (default: 0)
- `--demo` — Demo mode: warm up models for zero cold-start

## Demos

### `openeye g1-demo`

Run the Unitree G1 Safety Guardian demo.

```bash
openeye g1-demo
openeye g1-demo --transport rtsp --control-mode sdk --host 192.168.123.161
```

**Options:**

- `--transport` — webcam, usb, rtsp, sdk, auto (default: webcam)
- `--host` — G1 IP address (default: 192.168.123.161)
- `--control-mode` — sdk, http, dry_run (default: dry_run)
- `--model` — Detection model (default: yolov8)
- `--danger-m` — Danger zone metres (default: 0.5)
- `--caution-m` — Caution zone metres (default: 1.5)
- `--clear-duration` — Seconds before resume (default: 2.0)
- `--max-fps` — Camera frame rate cap (default: 15.0)
- `-c, --camera` — USB device index (default: 0)

## Configuration

### `openeye config`

View or set configuration values stored in `~/.openeye/config.yaml`.

```bash
openeye config get default_model
openeye config set default_model yolov8
openeye config reset
```

## Fleet Management

All fleet commands require `OPENEYE_FLEET_URL` (default `http://localhost:8001`) and `OPENEYE_TOKEN`.

### Device Management

```bash
openeye fleet register my-cam --type camera    # Register device
openeye fleet ls --status online               # List devices
openeye fleet info <device_id>                 # Device details
openeye fleet restart <device_id>              # Restart device
openeye fleet decommission <device_id>         # Decommission
openeye fleet tag <device_id> location=warehouse floor=2
openeye fleet config <device_id> '{"key": "value"}'
```

### Deployments

```bash
openeye fleet deploy --name v2-rollout --model yolov8 --version 2.0 --strategy canary
openeye fleet rollback <deployment_id>
openeye fleet deployments --status in_progress
```

### Groups & Alerts

```bash
openeye fleet group-create my-group --desc "Floor 2 cameras"
openeye fleet groups
openeye fleet alerts
```

### Device Agent

```bash
openeye fleet agent --device-id <id> --api-key <key> --server <url>
```

## MLOps

### Model Registry

```bash
openeye mlops upload model.onnx --name "Custom" --key custom --format onnx
openeye mlops registry                         # List all models
openeye mlops versions custom                  # Version history
openeye mlops promote custom v1.0.0 production
```

### A/B Testing & Shadow Mode

```bash
openeye mlops ab-test custom --a v1.0.0 --b v2.0.0 --split 0.5
openeye mlops ab-status custom
openeye mlops shadow custom --prod v1.0.0 --shadow v2.0.0
openeye mlops shadow-status custom
```

### Export & Batch

```bash
openeye mlops export custom v1.0.0 onnx --quantize
openeye mlops batch custom v1.0.0 ./images ./output --batch-size 32
openeye mlops benchmark custom --runs 20
```

### Lineage & Feedback

```bash
openeye mlops lineage custom v1.0.0
openeye mlops retrain my-pipeline
openeye mlops annotate custom v1.0.0 image.jpg --label dog --type misclassification
openeye mlops feedback custom output/
```

## Governance

```bash
openeye govern ...    # Policy management and enforcement
```

## Desktop

```bash
openeye desktop ...   # Desktop capture and analysis
```

## Debug

```bash
openeye debug ...     # Debugging and inspection tools
```

## Robotics

```bash
openeye robotics ...  # Robotics integration commands
```

## MCP Server

```bash
openeye mcp                        # Start MCP server (stdio transport)
openeye mcp --monitor 2            # Use secondary monitor
openeye mcp --vlm-model qwen-vl    # Specify VLM model
```

## Utility

### `openeye --version`

Show version and exit.

```bash
openeye --version
```

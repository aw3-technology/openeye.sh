# CLI Commands

OpenEye provides model management, inference, demo, and subcommand groups for fleet, MLOps, and governance.

## Model Management

### `openeye list`

List all registered models and their download status.

```bash
openeye list
```

Output shows model name, task, size, hardware tags, and whether it's downloaded.

### `openeye pull <model>`

Download model weights from the registry.

```bash
openeye pull yolov8
openeye pull depth-anything
openeye pull grounding-dino
```

**Options:**

- `--variant <name>` — Pull a specific variant (e.g., `onnx`, `tensorrt`)
- `--force` — Re-download even if already present

### `openeye remove <model>`

Delete a downloaded model from the local cache.

```bash
openeye remove yolov8
```

### `openeye add-model`

Register a custom model in the local registry.

### `openeye register-adapter`

Register a custom adapter for a model backend.

### `openeye update-registry`

Update the model registry from the upstream source.

## Inference

### `openeye run <model> [image]`

Run inference on a single image and print JSON results. Supports stdin piping for chaining commands.

```bash
openeye run yolov8 photo.jpg
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
openeye run yolov8 photo.jpg --visualize
openeye run yolov8 photo.jpg --backend onnx
```

**Options:**

- `--prompt, -p <text>` — Text prompt for open-vocabulary models (e.g., grounding-dino)
- `--output, -o <path>` — Write JSON results to a file instead of stdout
- `--pretty` — Pretty-print JSON output
- `--visualize` — Save an annotated image with bounding boxes or depth map
- `--backend, -b <onnx|tensorrt>` — Use a specific runtime backend
- `--variant <name>` — Use a specific model variant

### `openeye bench <model>`

Benchmark a model's inference speed.

```bash
openeye bench yolov8
openeye bench yolov8 --variant onnx --runs 50
```

**Options:**

- `--variant <name>` — Variant to benchmark
- `--warmup <n>` — Number of warmup runs (default: 3)
- `--runs <n>` — Number of timed runs (default: 10)
- `--width <px>` — Test image width (default: 640)
- `--height <px>` — Test image height (default: 480)

### `openeye serve <model>`

Start a FastAPI server with REST API, WebSocket streaming, and a browser dashboard.

```bash
openeye serve yolov8
openeye serve yolov8 --port 9000
openeye serve yolov8 --demo
openeye serve yolov8 --vlm-model qwen/qwen3.5-9b
```

**Options:**

- `--host <addr>` — Bind address (default: `0.0.0.0`)
- `--port <num>` — Port number (default: `8000`)
- `--demo` — Demo mode: warm up model for zero cold-start, show live status bar with uptime/requests/connections
- `--vlm-model <id>` — VLM model ID for the `/ws/vlm` perception endpoint (e.g., `qwen/qwen3.5-9b`)
- `--cortex-llm <id>` — Cortex LLM model ID for agentic reasoning (e.g., `z-ai/glm-5-turbo`)

### `openeye watch`

Live camera feed with real-time detections displayed in the terminal using Rich.

```bash
openeye watch --models yolov8
openeye watch --models yolov8,depth-anything
openeye watch --models yolov8 --safety
openeye watch --models yolov8 --video demo.mp4
```

**Options:**

- `--models, -m <names>` — Comma-separated model names (default: `yolov8`)
- `--camera, -c <index>` — Camera index (default: `0`)
- `--video, -v <path>` — Video file path (used as fallback if camera fails, or as primary source)
- `--safety, -s` — Enable Safety Guardian overlay with zone-based human detection
- `--danger-m <meters>` — Danger zone threshold in metres (default: `0.5`, requires `--safety`)
- `--caution-m <meters>` — Caution zone threshold in metres (default: `1.5`, requires `--safety`)
- `--demo` — Demo mode: warm up models for zero cold-start

## Demos

### `openeye g1-demo`

Unitree G1 robot safety demo with Rich CLI output. Demonstrates real-time human detection, zone-based safety evaluation, and robot halt/resume commands.

See [G1 Demo Quickstart](../../g1-demo-quickstart.md) for details.

## Configuration

### `openeye config`

View or set configuration values.

```bash
openeye config get default_model
openeye config set default_model yolov8
```

Configuration is stored in `~/.openeye/config.yaml`.

## Fleet Management

### `openeye fleet`

Subcommands for managing edge devices, deployments, and groups.

```bash
openeye fleet register <name> [--type camera|robot|edge_node|gateway|drone]
openeye fleet ls [--status online|offline] [--type camera|robot]
openeye fleet info <device-id>
openeye fleet restart <device-id>
openeye fleet decommission <device-id>
openeye fleet tag <device-id> --key <value>
openeye fleet config <device-id>
openeye fleet deploy <device-id> --model <key> [--version <v>]
openeye fleet rollback <device-id>
openeye fleet deployments [--status]
openeye fleet group-create <name> [--devices id1,id2]
openeye fleet groups
openeye fleet alerts [--status]
openeye fleet agent <device-id>
```

## MLOps

### `openeye mlops`

Model lifecycle and operations subcommands.

```bash
openeye mlops upload <file> --name <name> --key <key> --format onnx|torchscript|safetensors
openeye mlops registry
openeye mlops versions <model-key>
openeye mlops promote <key> <version> <stage>
openeye mlops batch <model> [--input-dir <dir>] [--output-dir <dir>]
openeye mlops compare <model1> <model2> [--dataset <path>]
openeye mlops feedback <model> [--test-results <path>]
openeye mlops export <model> [--format onnx|torchscript] [--optimize]
openeye mlops validate <model> [--dataset <path>]
openeye mlops lineage <model>
openeye mlops shadow <model> --prod-model <model>
openeye mlops retraining <model> [--trigger]
```

## Governance

### `openeye govern`

Safety policy management, audit logs, and rule enforcement subcommands.

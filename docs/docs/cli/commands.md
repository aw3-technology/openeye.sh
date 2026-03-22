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

Subcommands for managing edge devices, deployments, groups, alerts, and maintenance.

### Device Management

```bash
openeye fleet register <name> [--type camera|robot|edge_node|gateway|drone]
openeye fleet ls [--status online|offline|error] [--type camera|robot|edge_node|gateway|drone]
openeye fleet info <device-id>
openeye fleet tag <device-id> key=value [key2=value2 ...]
openeye fleet config <device-id> '<json-string>'
openeye fleet resources <device-id> [--limit 20]
openeye fleet restart <device-id>
openeye fleet decommission <device-id> [--reason <text>] [--wipe]
openeye fleet batch <action> [--tag key=value] [--payload '<json>']
```

| Subcommand | Description |
|------------|-------------|
| `register` | Register a new device and receive its ID + API key |
| `ls` | List all devices with optional status/type filters |
| `info` | Show full device details as JSON |
| `tag` | Set key=value tags on a device |
| `config` | Set config overrides on a device (JSON string) |
| `resources` | Show resource usage history (CPU, memory, disk, GPU) |
| `restart` | Send restart command to a device |
| `decommission` | Decommission a device with optional data wipe |
| `batch` | Send a command to devices matching a tag filter |

### Groups

```bash
openeye fleet group-create <name> [--desc <description>]
openeye fleet groups
openeye fleet group-add <group-id> <device-id>
openeye fleet group-remove <group-id> <device-id>
openeye fleet group-members <group-id>
openeye fleet group-scaling <group-id> [--enabled/--disabled] [--min 1] [--max 10] [--target-cpu 70]
```

| Subcommand | Description |
|------------|-------------|
| `group-create` | Create a device group |
| `groups` | List all device groups |
| `group-add` | Add a device to a group |
| `group-remove` | Remove a device from a group |
| `group-members` | List devices in a group |
| `group-scaling` | Set auto-scaling policy for a group |

### Deployments

```bash
openeye fleet deploy --model <key> --version <v> [--name <name>] [--strategy canary|rolling|blue_green|all_at_once] [--group <group-id>] [--url <model-url>]
openeye fleet deployments [--status pending|in_progress|completed|failed|rolled_back]
openeye fleet advance <deployment-id>
openeye fleet pause-deployment <deployment-id>
openeye fleet rollback <deployment-id>
openeye fleet ota --url <firmware-url> --version <v> [--group <group-id>] [--devices id1,id2] [--force]
```

| Subcommand | Description |
|------------|-------------|
| `deploy` | Create a staged model deployment (name auto-generated if omitted) |
| `deployments` | List deployments with optional status filter |
| `advance` | Advance a canary deployment to the next rollout stage |
| `pause-deployment` | Pause a running deployment |
| `rollback` | Rollback a deployment to the previous model version |
| `ota` | Push an OTA firmware/software update to devices |

### Alerts

```bash
openeye fleet alerts [--resolved true|false]
openeye fleet resolve-alert <alert-id>
```

| Subcommand | Description |
|------------|-------------|
| `alerts` | List fleet alerts (shows unresolved by default) |
| `resolve-alert` | Resolve a fleet alert by ID |

### Maintenance

```bash
openeye fleet maintenance-create --name <name> --start <iso8601> --end <iso8601> [--devices id1,id2] [--group <group-id>]
openeye fleet maintenance-list [--active]
openeye fleet maintenance-update <window-id> [--name <name>] [--start <iso8601>] [--end <iso8601>]
openeye fleet maintenance-delete <window-id>
```

| Subcommand | Description |
|------------|-------------|
| `maintenance-create` | Create a maintenance window for devices or a group |
| `maintenance-list` | List maintenance windows (optionally active-only) |
| `maintenance-update` | Update a maintenance window's name, start, or end time |
| `maintenance-delete` | Delete a maintenance window |

## MLOps

### `openeye mlops`

Model lifecycle and operations subcommands, organized into deployment, evaluation, and training workflows.

### Deployment & Registry

```bash
openeye mlops upload <file> --name <name> --key <key> --format onnx|torchscript|safetensors
openeye mlops registry
openeye mlops versions <model-key>
openeye mlops promote <key> <version> <stage> [--requester <name>] [--reason <text>]
openeye mlops approve <key> <version> [--approver <name>]
openeye mlops reject <key> <version> [--approver <name>] [--reason <text>]
openeye mlops export <key> <version> <format> [--output <path>] [--quantize]
openeye mlops exports [--model <key>]
openeye mlops lineage <key> <version>
```

### A/B Testing & Shadow Mode

```bash
openeye mlops ab-test <key> --a <version> --b <version> [--split 0.5] [--max-samples <n>]
openeye mlops ab-status [<key>]
openeye mlops shadow <key> --prod <version> --shadow <version> [--sample-rate 1.0]
openeye mlops shadow-status [<key>]
```

### Evaluation & Validation

```bash
openeye mlops benchmark <model> [--runs 100] [--width 640] [--height 480]
openeye mlops batch <key> <version> <input-path> <output-path> [--batch-size 32] [--workers 4]
openeye mlops validate <model> <version> <test-id>
openeye mlops validation-create --name <name> --model <key> --dataset <path> --conditions <expr>
openeye mlops validations [--model <key>]
openeye mlops validation-runs [--test <id>] [--model <key>]
```

### Training & Feedback

```bash
openeye mlops retrain <pipeline-name> [--by <triggerer>]
openeye mlops pipeline-create --name <name> --model <key> --script <path> [--dataset <path>]
openeye mlops pipelines [--model <key>]
openeye mlops runs [--pipeline <name>] [--model <key>]
openeye mlops run-status <run-id>
openeye mlops annotate <key> <version> <image> --label <label> [--type misclassification]
openeye mlops annotations [--model <key>] [--label <type>] [--unfed]
openeye mlops feedback <key> <output-path>
openeye mlops feedback-batches [--model <key>]
```

## Agent

### `openeye agent`

Agentic perception loop — perceive, reason, act.

```bash
openeye agent run --model yolov8 --goal "monitor workspace safety"
openeye agent run --model yolov8 --video demo.mp4 --max-ticks 20
openeye agent start --goal "detect hazards"
openeye agent stop
openeye agent status
openeye agent memory --limit 10
openeye agent recall "when did a person enter?"
```

| Subcommand | Description |
|------------|-------------|
| `run` | Run the agentic perception loop locally on camera or video |
| `start` | Start the agentic loop on a running server |
| `stop` | Stop the agentic loop on a running server |
| `status` | Show agentic loop status (running, tick count, plan, goal) |
| `memory` | Show recent observations from the agent's memory |
| `recall` | Query agent memory with a natural language search |

**`agent run` Options:**

- `--model <name>` — Detection model to use (default: `yolov8`)
- `--goal <text>` — Goal for the agent to pursue
- `--hz <float>` — Tick frequency in Hz
- `--video <path>` — Video file input (instead of camera)
- `--max-ticks <n>` — Maximum ticks before stopping
- `--vlm <id>` — VLM model for reasoning

## Hosted API

### `openeye api`

Client commands for the hosted inference API.

```bash
openeye api detect photo.jpg --pretty
openeye api depth scene.png
openeye api describe photo.jpg --prompt "what hazards are present?"
openeye api models
openeye api usage --days 7
```

| Subcommand | Description |
|------------|-------------|
| `detect` | Run object detection via hosted API |
| `depth` | Run depth estimation via hosted API |
| `describe` | Get VLM scene description via hosted API |
| `models` | List available hosted models and credit costs |
| `usage` | Show credit balance and usage statistics |

**Common Options:**

- `--server <url>` — API server URL (default: `$OPENEYE_API_URL` or `http://localhost:8001`)
- `--pretty` — Pretty-print JSON output
- `--confidence <float>` — Minimum confidence threshold (for `detect`)
- `--prompt <text>` — Custom prompt (for `describe`)
- `--days <n>` — Usage history period (for `usage`, default: 30)

## Server Utilities

### `openeye health`

Check server health and queue status.

```bash
openeye health
openeye health --server http://localhost:9000
```

### `openeye nebius-stats`

Show Nebius VLM usage statistics from a running server.

```bash
openeye nebius-stats
```

### `openeye server-config-get`

Get runtime configuration from a running server.

### `openeye server-config-set`

Update a runtime config value on a running server.

```bash
openeye server-config-set vlm_model "Qwen/Qwen3-VL-72B"
```

## Governance

### `openeye govern`

Safety policy management, audit logs, and rule enforcement subcommands.

```bash
openeye govern status
openeye govern ls
openeye govern enable pii-filter
openeye govern disable pii-filter
openeye govern presets
openeye govern load safety-strict
openeye govern load custom-policy.yaml
openeye govern validate governance.yaml
openeye govern audit [--server <url>] [--limit 20]
openeye govern violations [--server <url>] [--limit 20]
openeye govern init [--domain robotics|desktop_agent|universal] [--output governance.yaml]
```

| Subcommand | Description |
|------------|-------------|
| `status` | Show current governance status and policy count |
| `ls` | List all available policies (built-in + plugins) |
| `enable` | Enable a governance policy by name |
| `disable` | Disable a governance policy by name |
| `presets` | List available governance presets |
| `load` | Load a preset or custom YAML config |
| `validate` | Validate a YAML governance config file |
| `audit` | Show recent audit trail from a running server |
| `violations` | Show governance violations (deny/warn decisions) |
| `init` | Generate a starter YAML governance config for a domain |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENEYE_SERVER_URL` | `http://localhost:8000` | Default inference server URL |
| `OPENEYE_FLEET_URL` | `http://localhost:8001` | Fleet control plane URL |
| `OPENEYE_API_URL` | `http://localhost:8001` | Hosted API URL |
| `OPENEYE_TOKEN` | — | Fleet authentication token |
| `OPENEYE_API_KEY` | — | Hosted API key (format: `oe_...`) |
| `NEBIUS_API_KEY` | — | Nebius VLM API key |
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.com/v1` | Nebius API endpoint |
| `NEBIUS_MODEL` | `Qwen/Qwen2.5-VL-72B-Instruct` | Default VLM model |
| `OPENROUTER_API_KEY` | — | OpenRouter VLM alternative key |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins |

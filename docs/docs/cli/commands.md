# CLI Commands

OpenEye provides model management, inference, demo, and server-utility commands, plus subcommand groups for `config`, `fleet`, `mlops`, `govern`, `agent`, and `api` (the hosted API). Run `openeye --help`, `openeye <command> --help`, or `openeye docs` (add `--json` for machine-readable output) for the built-in reference. `openeye --version` / `-v` prints the installed version.

## Model Management

### `openeye list`

List all registered models and their download status.

```bash
openeye list
```

Output shows model name, task, size, hardware tags, and whether it's downloaded.

### `openeye pull [model]`

Download model weights to `~/.openeye/models/`.

```bash
openeye pull yolov8
openeye pull depth-anything
openeye pull yolov8 --quantized
openeye pull --all
```

Registered models: `yolov8`, `depth-anything`, `grounding-dino`, `yolo26`, `sam2`, `rfdetr`, `smolvla` (see `cli/openeye_ai/models.yaml`).

**Options:**

- `--all` — Pull every model in the registry
- `--variant <name>` — Pull a specific variant
- `--quantized` — Shortcut for `--variant quantized`
- `--force` — Re-download even if already present

### `openeye remove <model>`

Delete downloaded model weights from `~/.openeye/models/`.

```bash
openeye remove yolov8
```

### `openeye add-model <key>`

Add a new model to the registry.

```bash
openeye add-model my-detector --task detection --adapter onnx_generic --hf-repo me/my-detector --filename model.onnx
```

**Options:** `--name` (defaults to key), `--task` (`detection`, `depth`, `segmentation`, `classification`, `embedding`), `--adapter` (adapter key or path to a `.py` file), `--hf-repo`, `--filename`, `--size-mb`, `--description`.

### `openeye register-adapter <key> <adapter-path>`

Register a custom adapter file and add it to the registry. Options: `--name`, `--task`, `--description`. See [Custom Adapter](../tutorials/custom-adapter.md).

### `openeye update-registry`

Fetch the remote registry and merge new models into your local one.

## Inference

### `openeye run <model> [image]`

Run inference on an image (or every image in a directory) and print unified JSON. Pass `-` (or omit the image) to read from stdin: either raw image bytes or the JSON output of a previous `openeye run`, so commands can be chained.

```bash
openeye run yolov8 photo.jpg
openeye run yolov8 ./images/
cat photo.jpg | openeye run yolov8 -
openeye run yolov8 photo.jpg | openeye run depth-anything -
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
- `--confidence, -c <float>` — Minimum confidence threshold (0.0–1.0)

### `openeye bench <model>`

Benchmark a model's inference speed.

```bash
openeye bench yolov8
openeye bench yolov8 --variant quantized --runs 50
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

See [Server API](server-api.md) for the endpoints, and [Connect the openeye.sh dashboard](server-api.md#connect-the-openeyesh-dashboard) to drive a local server from the web dashboard.

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

```bash
openeye g1-demo --transport webcam --control-mode dry_run
```

**Options:** `--transport` (`webcam`, `usb`, `rtsp`, `sdk`, `auto`; default `webcam`), `--host` (G1 IP, default `192.168.123.161`), `--camera, -c` (default `0`), `--control-mode` (`sdk`, `http`, `dry_run`; default `dry_run`), `--model, -m` (default `yolov8`), `--danger-m` (default `0.5`), `--caution-m` (default `1.5`), `--clear-duration` (seconds clear before resume, default `2.0`), `--max-fps` (default `15.0`), `--video, -v`, `--demo`.

See the [G1 Safety Demo](../tutorials/g1-demo.md) tutorial for details.

### `openeye vlm-demo`

Send an image to a vision-language model through OpenRouter (needs `OPENROUTER_API_KEY`).

```bash
openeye vlm-demo --image photo.jpg --prompt "What hazards do you see?"
openeye vlm-demo --all-models
```

**Options:** `--image` (default `src/assets/demo/scene-warehouse.jpg`, a path inside the repo), `--model, -m` (OpenRouter model ID, default `qwen/qwen3-vl-235b:free`), `--prompt, -p`, `--all-models` (compare all free VLM models side by side).

## Configuration

### `openeye config`

Get and set key/value pairs in `~/.openeye/config.yaml`.

```bash
openeye config set default-device gpu
openeye config get default-device
```

`config get` exits with code 1 if the key isn't set. Values are stored as strings. No built-in command currently reads these values, so treat this as a local settings store.

## Fleet Management

### `openeye fleet`

Subcommands for managing edge devices, deployments, groups, alerts, and maintenance against a self-hosted fleet control plane (see [Fleet Management](../tutorials/fleet-management.md)).

All fleet commands call `$OPENEYE_FLEET_URL` (default `http://localhost:8001`). All except `fleet agent` require `OPENEYE_TOKEN`, a Better Auth session token from the database the control plane uses.

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
openeye fleet batch <command> [--tag key=value] [--payload '<json>']
openeye fleet commands [--device <device-id>] [--status <status>]
openeye fleet agent --device-id <uuid> --api-key oek_... [--server http://localhost:8001] [--interval 15]
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
| `commands` | List pending device commands |
| `agent` | Start the device agent on an edge device (heartbeats, command polling) |

`fleet agent` authenticates with the device key returned at registration (`--api-key` or `OPENEYE_DEVICE_API_KEY`); its `--server` defaults to `$OPENEYE_FLEET_URL` (or `http://localhost:8001`).

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
| `alerts` | List fleet alerts (all alerts unless `--resolved` is given) |
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

Model lifecycle and operations subcommands. State is kept in YAML files under `~/.openeye/` (registry, promotions, A/B tests, runs, and so on).

### Registry, Promotion & Export

```bash
openeye mlops upload <file> [--name <name>] [--key <key>] [--format onnx|torchscript|safetensors|pytorch] [--task detection] [--author <name>] [--description <text>] [--adapter onnx_generic]
openeye mlops registry
openeye mlops versions <model-key>
openeye mlops promote --model <key> --version <v> --from dev|staging --to staging|production [--requester cli-user] [--reason <text>]
openeye mlops approve-promotion --model <key> --version <v> [--approver cli-user]
openeye mlops reject-promotion --model <key> --version <v> [--approver cli-user] [--reason <text>]
openeye mlops export <model-key> --format onnx|tensorrt|coreml [--version latest] [--output <path>] [--quantize]
openeye mlops exports [--model <key>]
openeye mlops lineage <model-key> <version>
```

`upload` auto-detects `--format` when omitted and defaults `--name`/`--key` to the file name.

### A/B Testing & Shadow Mode

```bash
openeye mlops create-ab-test --champion <version> --challenger <version> [--traffic 50/50] [--name <name>] [--model <key>] [--max-samples <n>]
openeye mlops ab-tests [<model-key>]
openeye mlops complete-ab-test <test-id>
openeye mlops shadow-mode --champion <version> --challenger <version> [--model <key>] [--sample-rate 1.0] [--max-samples <n>]
openeye mlops shadow-status [<model-key>]
```

`--model` is auto-detected from the champion version when omitted.

### Evaluation, Benchmarks & Validation

```bash
openeye mlops evaluate <model> --dataset <path> [--version latest] [--iou 0.5] [--confidence 0.25]
openeye mlops benchmark <model> [--runs 100] [--width 640] [--height 480]
openeye mlops batch-create --model <key> --input <path> [--output <path>] [--version latest] [--batch-size 32] [--workers 4] [--format jsonl|csv]
openeye mlops validation-create --name <name> --model <key> --dataset <path> --conditions "accuracy > 0.95,latency_ms < 50" [--desc <text>]
openeye mlops validate <model> <version> <test-id>
openeye mlops validations [--model <key>]
openeye mlops validation-runs [--test <id>] [--model <key>]
```

`evaluate --dataset` accepts COCO JSON, JSONL, or an image directory. `batch-create --input` accepts a local directory, `s3://`, or `gs://` path.

### Training & Feedback

```bash
openeye mlops pipeline-create --name <name> [--model default] [--script train.py] [--dataset <path>] [--schedule "0 2 * * *"]
openeye mlops pipelines [--model <key>]
openeye mlops retrain <pipeline-name> [--by manual]
openeye mlops runs [--pipeline <name>] [--model <key>]
openeye mlops run-status <run-id>
openeye mlops feedback --prediction-id <id> --correct true|false [--label <label>] [--model default] [--version latest] [--annotator cli-user] [--notes <text>]
openeye mlops annotate <model-key> <version> <image> --label <label> [--type misclassification] [--predicted <label>] [--annotator cli-user] [--notes <text>]
openeye mlops annotations [--model <key>] [--label <type>] [--unfed]
openeye mlops feedback-generate <model-key> <output>
openeye mlops feedback-batches [--model <key>]
```

`annotate --type` is one of `false_positive`, `false_negative`, `misclassification`, `wrong_bbox`, `low_confidence`. `feedback --label` is required when `--correct false`.

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

- `--model, -m <name>` — Detection model to use (default: `yolov8`)
- `--goal, -g <text>` — Goal for the agent to pursue (default: `monitor the scene`)
- `--hz <float>` — Tick frequency in Hz (default: `1.0`)
- `--video <path>` — Video file input (fallback if no camera)
- `--max-ticks <n>` — Stop after N ticks
- `--vlm` — Enable VLM reasoning via Nebius (a flag, not a model ID; needs `NEBIUS_API_KEY` or `OPENROUTER_API_KEY`)

`start`, `stop`, `status`, `memory` (`--limit, -n`, default 10), and `recall <query>` (`--limit, -n`, default 5) talk to a running `openeye serve`; they take `--server, -s` (default `$OPENEYE_SERVER_URL`, `http://localhost:8000`).

## Hosted API

### `openeye api`

Client for the hosted inference API at `https://openeye.sh/v1`. Create a key in the dashboard under **Settings → API Keys**, then:

```bash
export OPENEYE_API_KEY=oe_your_key_here
openeye api detect photo.jpg
openeye api detect photo.jpg --confidence 0.5 --pretty
openeye api describe photo.jpg --prompt "what hazards are present?"
openeye api models
openeye api usage --days 7
```

| Subcommand | Description | Options |
|------------|-------------|---------|
| `detect <image>` | Object detection (YOLOv8, 1 credit) | `--confidence, -c` (default `0.25`), `--pretty, -p` (print the raw JSON) |
| `describe <image>` | VLM scene description (3 credits) | `--prompt, -p` (default `Describe what you see in this image.`) |
| `depth <image>` | Depth estimation | — |
| `models` | List hosted models and credit costs | — |
| `usage` | Credit balance and usage | `--days, -d` (default `30`) |

Every subcommand takes `--server, -s <url>` (default `$OPENEYE_API_URL`, or `https://openeye.sh`). The key is read from `OPENEYE_API_KEY` and sent as `Authorization: Bearer`.

!!! note "Hosted availability"
    `detect`, `models`, and `usage` are live. `describe` returns `503` until scene description is enabled on the hosted API, and `depth` returns `501` on the hosted API; point `--server` at a local `openeye serve depth-anything` to use it.

## Server Utilities

### `openeye health`

Check server health and queue status. `health`, `nebius-stats`, `server-config-get`, and `server-config-set` all take `--server, -s` (default `$OPENEYE_SERVER_URL`, `http://localhost:8000`).

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

Safety policy management, audit logs, and rule enforcement subcommands. `status`, `enable`, `disable`, `load`, `audit`, and `violations` take `--server, -s`; without it, `status`, `enable`, `disable`, and `load` act on the local engine.

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

| Variable | Default | Used by |
|----------|---------|---------|
| `OPENEYE_SERVER_URL` | `http://localhost:8000` | `health`, `nebius-stats`, `server-config-*`, `agent start/stop/status/memory/recall` |
| `OPENEYE_API_URL` | `https://openeye.sh` | `openeye api ...` |
| `OPENEYE_API_KEY` | — | `openeye api ...` (hosted API key, `oe_...`) |
| `OPENEYE_FLEET_URL` | `http://localhost:8001` | `openeye fleet ...` (including the `fleet agent --server` default) |
| `OPENEYE_TOKEN` | — | `openeye fleet ...` (Better Auth session token) |
| `OPENEYE_DEVICE_API_KEY` | — | `openeye fleet agent` (device key, `oek_...`) |
| `OPENEYE_SERVER_API_KEY` | — | `openeye serve`: if set, `/v1/*` accepts only this key |
| `CORS_ORIGINS` | `https://openeye.sh,https://www.openeye.sh,http://localhost:5173,http://localhost:3000,http://localhost:8080` | `openeye serve` allowed browser origins |
| `NEBIUS_API_KEY` | — | Nebius VLM provider |
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.com/v1` | Nebius API endpoint |
| `NEBIUS_MODEL` | `Qwen/Qwen2.5-VL-72B-Instruct` | Default VLM model |
| `OPENROUTER_API_KEY` | — | OpenRouter VLM provider (`vlm-demo`, `serve`, `agent run --vlm`) |

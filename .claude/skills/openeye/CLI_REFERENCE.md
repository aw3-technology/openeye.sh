# OpenEye CLI Reference

Built with Typer. Package `openeye-sh` 0.2.0 (Python >= 3.12). Entry points in `cli/pyproject.toml`:

- `openeye = "openeye_ai.cli:app"`
- `openeye-mcp = "openeye_ai.mcp.server:main"`

`cli/openeye_ai/cli.py` only registers commands; implementations live in `cli/openeye_ai/commands/`. The signatures below were generated from the Typer app — when in doubt, run `openeye <cmd> --help` or `openeye docs --json`.

Notation: `ARG` required, `ARG?` optional, `--opt=default`.

## Top-Level Commands

| Command | Arguments / options | Purpose |
|---|---|---|
| `openeye list` | | Available and downloaded models |
| `openeye pull` | `MODEL?` `--all` `--variant` `--quantized` `--force` | Download weights to `~/.openeye/models/` (interactive picker if no model) |
| `openeye remove` | `MODEL` | Delete downloaded weights |
| `openeye add-model` | `KEY` `--name` `--task` `--adapter` `--hf-repo` `--filename` `--size-mb` `--description` | Add a registry entry |
| `openeye register-adapter` | `KEY ADAPTER_PATH` `--name` `--task` `--description` | Register a custom adapter file and add it to the registry |
| `openeye update-registry` | | Merge the remote registry |
| `openeye run` | `MODEL IMAGE?` `-p/--prompt` `--pretty` `-o/--output` `--visualize` `-b/--backend` `--variant` `-c/--confidence` | Inference on an image or a directory → PredictionResult JSON |
| `openeye bench` | `MODEL` `--variant` `--warmup=3` `--runs=10` `--width=640` `--height=480` | Latency benchmark |
| `openeye serve` | `MODEL` `--host=0.0.0.0` `--port=8000` `--demo` `--vlm-model` `--cortex-llm` | Local FastAPI server (REST, `/v1`, WebSockets, browser dashboard at `/`) |
| `openeye watch` | `-m/--models=yolov8` `-c/--camera=0` `-v/--video` `-s/--safety` `--danger-m=0.5` `--caution-m=1.5` `--demo` | Live camera/video feed in the terminal (needs `[camera]`) |
| `openeye g1-demo` | `--transport=webcam` `--host=192.168.123.161` `-c/--camera=0` `--control-mode=dry_run` `-m/--model=yolov8` `--danger-m` `--caution-m` `--clear-duration=2.0` `--max-fps=15.0` `-v/--video` `--demo` | Unitree G1 safety guardian demo |
| `openeye vlm-demo` | `--image` `-m/--model=qwen/qwen3-vl-235b:free` `-p/--prompt` `--all-models` | VLM demo via OpenRouter (`OPENROUTER_API_KEY`) |
| `openeye health` | `-s/--server` | Health + queue status of a running server |
| `openeye nebius-stats` | `-s/--server` | Nebius VLM usage from a running server |
| `openeye server-config-get` | `-s/--server` | Runtime config of a running server |
| `openeye server-config-set` | `KEY VALUE` `-s/--server` | Update a runtime config value |
| `openeye docs` | `-j/--json` | Full CLI reference for agents and humans |
| `openeye --version` / `-v` | | Version |

`--server` defaults to `OPENEYE_SERVER_URL` (`http://localhost:8000`).

Model keys: `yolov8`, `depth-anything`, `grounding-dino`, `yolo26`, `sam2`, `rfdetr`, `smolvla`.

## `openeye api` — hosted inference API

Needs `OPENEYE_API_KEY=oe_...`. Base URL: `--server`, else `OPENEYE_API_URL`, else `https://openeye.sh`. Requests go to `<base>/v1/...`, so the same commands work against a local `openeye serve` (`--server http://localhost:8000`) or a self-hosted control plane (`--server http://localhost:8001`).

| Command | Arguments / options | Endpoint |
|---|---|---|
| `openeye api detect` | `IMAGE` `-c/--confidence=0.25` `-s/--server` `-p/--pretty` | `POST /v1/detect` (1 credit) |
| `openeye api depth` | `IMAGE` `-s/--server` | `POST /v1/depth` (501 on hosted) |
| `openeye api describe` | `IMAGE` `-p/--prompt="Describe what you see in this image."` `-s/--server` | `POST /v1/describe` (3 credits; 503 on hosted until enabled) |
| `openeye api models` | `-s/--server` | `GET /v1/models` |
| `openeye api usage` | `-d/--days=30` `-s/--server` | `GET /v1/usage` |

## `openeye config`

```
openeye config set KEY VALUE     # ~/.openeye/config.yaml
openeye config get KEY
```

## `openeye fleet` — self-hosted fleet control plane

Uses `OPENEYE_FLEET_URL` (default `http://localhost:8001`) and `OPENEYE_TOKEN` (a Better Auth session token). The control plane is not hosted at openeye.sh; run it yourself (see SKILL.md).

| Command | Arguments / options |
|---|---|
| `register` | `NAME` `-t/--type=edge_node` (camera, robot, edge_node, gateway, drone) |
| `ls` | `-s/--status` `-t/--type` |
| `info` | `DEVICE_ID` |
| `restart` | `DEVICE_ID` |
| `decommission` | `DEVICE_ID` `-r/--reason` `--wipe` |
| `tag` | `DEVICE_ID TAGS...` (`key=value`) |
| `config` | `DEVICE_ID CONFIG_JSON` |
| `resources` | `DEVICE_ID` `-n/--limit=20` |
| `batch` | `COMMAND` `-t/--tag` `-p/--payload` |
| `deploy` | `-n/--name` `-m/--model` `-v/--version` `--strategy=canary` (canary, rolling, blue_green, all_at_once) `-g/--group` `--url` |
| `deployments` | `-s/--status` |
| `advance` / `pause-deployment` / `rollback` | `DEPLOYMENT_ID` |
| `ota` | `-u/--url` `-v/--version` `-g/--group` `-d/--devices` `--force` |
| `group-create` | `NAME` `-d/--desc` |
| `groups` | |
| `group-add` / `group-remove` | `GROUP_ID DEVICE_ID` |
| `group-members` | `GROUP_ID` |
| `group-scaling` | `GROUP_ID` `--enabled` `--min=1` `--max=10` `--target-cpu=70.0` |
| `maintenance-create` | `-n/--name` `--start` `--end` `-d/--devices` `-g/--group` |
| `maintenance-list` | `--active` |
| `maintenance-update` | `WINDOW_ID` `-n/--name` `--start` `--end` |
| `maintenance-delete` | `WINDOW_ID` |
| `alerts` | `--resolved` |
| `resolve-alert` | `ALERT_ID` |
| `commands` | `-d/--device` `-s/--status` |
| `agent` | `-d/--device-id` `-k/--api-key` (or `OPENEYE_DEVICE_API_KEY`, an `oek_` key) `-s/--server=http://localhost:8001` `--interval=15.0` |

Devices registered in the openeye.sh dashboard get their `oek_` key once at registration; `openeye fleet agent` uses it to heartbeat and pull queued `device_commands`.

## `openeye agent` — agentic perception loop

| Command | Arguments / options |
|---|---|
| `run` | `-m/--model=yolov8` `-g/--goal="monitor the scene"` `--hz=1.0` `--video` `--max-ticks` `--vlm` (runs locally) |
| `start` | `-g/--goal` `-s/--server` (starts the loop on a running server) |
| `stop` / `status` | `-s/--server` |
| `memory` | `-n/--limit=10` `-s/--server` |
| `recall` | `QUERY` `-n/--limit=5` `-s/--server` |

## `openeye govern` — visual governance (safety policies)

| Command | Arguments / options |
|---|---|
| `status` | `-s/--server` |
| `ls` / `presets` | |
| `enable` / `disable` | `NAME` `-s/--server` |
| `load` | `TARGET` `-s/--server` |
| `validate` | `FILE` |
| `audit` / `violations` | `-s/--server` `-n/--limit=20` |
| `init` | `-d/--domain=robotics` `-o/--output=governance.yaml` |

`--server` is optional here; without it, commands act on local files.

## `openeye mlops` — model lifecycle

| Area | Commands |
|---|---|
| Registry | `upload FILE -n/--name -k/--key -f/--format -t/--task=detection --author -d/--description --adapter=onnx_generic` · `registry` · `versions MODEL_KEY` |
| Promotion | `promote -m/--model -v/--version --from --to --requester=cli-user --reason` · `approve-promotion -m -v --approver` · `reject-promotion -m -v --approver -r/--reason` |
| A/B and shadow | `create-ab-test --champion --challenger --traffic=50/50 --name -m/--model --max-samples` · `ab-tests MODEL_KEY?` · `complete-ab-test TEST_ID` · `shadow-mode --champion --challenger -m/--model --sample-rate=1.0 --max-samples` · `shadow-status MODEL_KEY?` |
| Retraining | `pipeline-create -n/--name -m/--model --script=train.py -d/--dataset --schedule` · `pipelines -m` · `retrain PIPELINE_NAME --by=manual` · `runs -p/--pipeline -m/--model` · `run-status RUN_ID` |
| Batch | `batch-create -m/--model -i/--input -o/--output -v/--version=latest --batch-size=32 --workers=4 --format=jsonl` |
| Feedback | `feedback --prediction-id --correct --label -m -v --annotator --notes` · `annotate MODEL_KEY VERSION IMAGE --label --type=misclassification --predicted --annotator --notes` · `annotations -m -l/--label --unfed` · `feedback-generate MODEL_KEY OUTPUT` · `feedback-batches -m` |
| Export | `export MODEL_KEY -f/--format -v/--version=latest -o/--output --quantize` · `exports -m` |
| Evaluation | `evaluate MODEL -d/--dataset -v/--version=latest --iou=0.5 -c/--confidence=0.25` · `benchmark MODEL --runs=100 --width=640 --height=480` · `lineage MODEL_KEY VERSION` |
| Validation | `validation-create -n/--name -m/--model -d/--dataset -c/--conditions --desc` · `validations -m` · `validation-runs -t/--test -m/--model` · `validate MODEL VERSION TEST_ID` |

## Install Extras

```bash
pipx install openeye-sh                 # core CLI
pipx install "openeye-sh[yolo]"         # YOLOv8 / YOLO26 (ultralytics)
pipx install "openeye-sh[depth]"        # Depth Anything (transformers, torch)
pipx install "openeye-sh[grounding]"    # Grounding DINO
pipx install "openeye-sh[sam]"          # SAM 2
pipx install "openeye-sh[rfdetr]"       # RF-DETR
pipx install "openeye-sh[smolvla]"      # SmolVLA (lerobot)
pipx install "openeye-sh[onnx]"         # ONNX Runtime   ([onnx-gpu] for GPU)
pipx install "openeye-sh[tensorrt]"     # TensorRT
pipx install "openeye-sh[camera]"       # OpenCV for watch/live camera
pipx install "openeye-sh[vlm]"          # OpenAI-compatible VLM client
pipx install "openeye-sh[cloud]"        # S3 / GCS
pipx install "openeye-sh[mcp]"          # MCP server (openeye-mcp)
pipx install "openeye-sh[all]"          # yolo + depth + grounding + vlm + OpenCV (not mcp/onnx/sam/...)
```

## MCP Server (`openeye-mcp`)

Stdio server in `cli/openeye_ai/mcp/server.py`. Local tools shell out to the `openeye` binary found next to the running Python (`cli/openeye_ai/mcp/tools.py`), falling back to `PATH`.

| Tool | Wraps |
|---|---|
| `openeye_list()` | `openeye list` |
| `openeye_pull(model)` | `openeye pull` |
| `openeye_run(model, image, prompt?, pretty?)` | `openeye run` |
| `openeye_serve(model, port=8000)` | `openeye serve` in the background |
| `openeye_health(port=8000)` | `GET /health` |
| `openeye_bench(model, runs=10)` | `openeye bench` |
| `openeye_remove(model)` | `openeye remove` |
| `openeye_nebius_stats()` | `openeye nebius-stats` |
| `openeye_api_detect(image_path, confidence)` | hosted `POST /v1/detect` (needs `OPENEYE_API_KEY`) |
| `openeye_api_describe(image_path, prompt)` | hosted `POST /v1/describe` (needs `OPENEYE_API_KEY`) |
| `openeye_api_models()` | hosted `GET /v1/models` (needs `OPENEYE_API_KEY`) |
| `openeye_api_usage(days)` | hosted `GET /v1/usage` (needs `OPENEYE_API_KEY`) |

```json
{ "mcpServers": { "openeye": { "command": "openeye-mcp", "env": { "OPENEYE_API_KEY": "oe_..." } } } }
```

In this repo, `.mcp.json` launches `cli/.venv/bin/python -m openeye_ai.mcp.server`; create that venv with `python3.12 -m venv cli/.venv && cli/.venv/bin/pip install -e "cli/[all,mcp]"`.

## File Paths

| File | Purpose |
|------|---------|
| `~/.openeye/models/` | Downloaded weights |
| `~/.openeye/config.yaml` | User configuration |
| `cli/openeye_ai/models.yaml` | Bundled model registry |
| `cli/openeye_ai/cli.py` | Command registration |
| `cli/openeye_ai/commands/` | Command implementations (`api_cli.py`, `fleet/`, `mlops/`, `governance/`, `agent_cli.py`, ...) |
| `cli/openeye_ai/_cli_helpers.py` | Default URLs, extras map, shared helpers |
| `cli/openeye_ai/registry.py` | Registry and adapter resolution |
| `cli/openeye_ai/adapters/base.py` | `ModelAdapter` ABC |
| `cli/openeye_ai/server/app.py` | FastAPI server factory |
| `cli/openeye_ai/mcp/server.py` | MCP tools |

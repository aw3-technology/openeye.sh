---
title: Server Utilities, Demos & Docs
---

### Talk to a running server

These call a running openeye serve at OPENEYE_SERVER_URL (default http://localhost:8000); each takes --server, -s <url>.

| Command | Description |
|---------|-------------|
| openeye health | Server health and inference queue status |
| openeye nebius-stats | Nebius VLM usage statistics (GET /nebius/stats) |
| openeye server-config-get | Print the server's runtime config (GET /config) |
| openeye server-config-set KEY VALUE | Update one runtime config value (VALUE is parsed as JSON when possible; the rest of the config is kept) |

```bash
openeye health
openeye server-config-set vlm_model qwen/qwen3.5-9b
```

### openeye govern

Visual governance: policies, presets, and the audit trail. Without --server these work on the local governance engine; with --server they act on a running server's /governance API.

| Command | Description |
|---------|-------------|
| govern status [--server] | Current governance status |
| govern ls | List available policies (built-in and plugins) |
| govern enable NAME [--server] | Enable a policy |
| govern disable NAME [--server] | Disable a policy |
| govern presets | List presets |
| govern load TARGET [--server] | Load a preset or a custom YAML config |
| govern validate FILE | Validate a YAML governance config |
| govern audit [--server] [--limit, -n 20] | Recent audit trail |
| govern violations [--server] [--limit, -n 20] | Violations from the audit trail |
| govern init [--domain, -d robotics] [--output, -o governance.yaml] | Write a starter config (domains: robotics, desktop_agent, universal) |

See Governance API for the HTTP routes.

### openeye mlops

Model lifecycle commands: registry and versions, promotion gates (promote, approve-promotion, reject-promotion), A/B tests and shadow mode, retraining pipelines, batch inference, feedback and annotations, export (ONNX, TensorRT, CoreML), lineage, evaluation, benchmarks, and validation tests. State is kept in YAML files under ~/.openeye/. Run openeye mlops --help or openeye docs for every subcommand and flag; MLOps API documents the matching HTTP routes on openeye serve.

### Demos

| Command | Description |
|---------|-------------|
| openeye g1-demo | Unitree G1 Safety Guardian demo |
| openeye vlm-demo | Send an image to a VLM via OpenRouter (needs OPENROUTER_API_KEY) |

g1-demo options: --transport (webcam, usb, rtsp, sdk, auto; default webcam), --host (G1 IP, default 192.168.123.161), --camera, -c (default 0), --control-mode (sdk, http, dry_run; default dry_run), --model, -m (default yolov8), --danger-m (0.5), --caution-m (1.5), --clear-duration (2.0 s), --max-fps (15), --video, -v, --demo.

```bash
openeye g1-demo --control-mode dry_run --demo
```

vlm-demo options: --image (default src/assets/demo/scene-warehouse.jpg, relative to a repo checkout), --model, -m (default qwen/qwen3-vl-235b:free), --prompt, -p, --all-models (compare all free VLM models side by side).

### openeye docs

Prints the full CLI reference. Add --json, -j to get it wrapped in JSON ({"reference": "..."}) for AI agents.

```bash
openeye docs --json | jq -r .reference
```

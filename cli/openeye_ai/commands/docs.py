"""openeye docs — machine-readable CLI reference for AI agents."""

from __future__ import annotations

import json

import typer
from rich import print as rprint

DOCS = r"""# OpenEye CLI Reference

OpenEye is a CLI for vision AI models — pull, run, serve, and manage
computer-vision models from your terminal.  Think "Ollama for vision."

Install: `pipx install openeye-sh`

---

## Quick start

```bash
openeye pull yolov8              # download a model
openeye run yolov8 photo.jpg     # run inference on an image
openeye serve yolov8             # start REST/WebSocket API server
openeye bench yolov8             # benchmark latency & throughput
```

---

## Available models

| Key              | Task          | Description                                      |
|------------------|---------------|--------------------------------------------------|
| yolov8           | detection     | Real-time object detection — 80 COCO classes     |
| yolo26           | detection     | Latest YOLO generation — 80 COCO classes         |
| depth-anything   | depth         | Monocular depth estimation                       |
| grounding-dino   | detection     | Open-vocabulary detection with text prompts      |
| sam2             | segmentation  | Zero-shot segmentation via Segment Anything 2    |
| rfdetr           | detection     | Real-time detection transformer without NMS      |
| smolvla          | vla           | Vision-language-action model for robotic control |

Use `openeye list` to see download status, sizes, and hardware support.

---

## Commands

### Model management
| Command                | Description                                |
|------------------------|--------------------------------------------|
| `openeye list`         | List models with status, size, hardware    |
| `openeye pull <model>` | Download model weights                     |
| `openeye remove <model>` | Delete downloaded model weights          |
| `openeye add-model`    | Add a new model to the registry            |
| `openeye register-adapter` | Register a custom adapter              |
| `openeye update-registry` | Fetch and merge remote registry updates |

### Inference
| Command | Description |
|---------|-------------|
| `openeye run <model> <image>` | Single-image inference. Outputs JSON with detections/depth map. Supports `--pretty` for visual output, `--confidence` threshold, `--output` to save annotated image, `-p` prompt for grounding models. Accepts stdin (JSON pipeline or raw image bytes). |
| `openeye bench <model>` | Benchmark model latency. Options: `--runs`, `--warmup`, `--width`, `--height`. |
| `openeye serve <model>` | Start FastAPI server with REST + WebSocket endpoints. Options: `--host`, `--port`, `--demo`, `--vlm-model`, `--cortex-llm`. |
| `openeye watch <model>` | Live camera feed with real-time detections in terminal. Options: `--models` (comma-sep), `--camera`, `--video`, `--safety`, `--danger-m`, `--caution-m`. |

### Server endpoints (when `openeye serve` is running)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict` | POST | Inference — multipart image upload, returns JSON |
| `/health` | GET | Server health and queue status |
| `/metrics` | GET | Prometheus metrics |
| `/ws/predict` | WS | Streaming inference |
| `/ws/perception` | WS | Real-time perception loop |
| `/ws/vlm` | WS | Vision Language Model reasoning |
| `/ws/agentic` | WS | Agentic loop (perceive → reason → act) |
| `/v1/detect` | POST | Hosted API — object detection (credit-tracked) |
| `/v1/depth` | POST | Hosted API — depth estimation (credit-tracked) |
| `/v1/describe` | POST | Hosted API — VLM image description (credit-tracked) |
| `/v1/models` | GET | List available API models |
| `/v1/usage` | GET | API usage and remaining credits |

### Fleet management (`openeye fleet ...`)
| Command | Description |
|---------|-------------|
| `fleet register` | Register a new device |
| `fleet ls` | List devices (filter by `--status`, `--type`) |
| `fleet info <id>` | Show device details |
| `fleet restart <id>` | Restart a device |
| `fleet decommission <id>` | Decommission a device |
| `fleet tag <id>` | Add tags to a device |
| `fleet config <id>` | Override device configuration |
| `fleet resources <id>` | Show device resource usage |
| `fleet batch` | Send batch commands |
| `fleet deploy` | Create staged deployment (canary/rolling/blue-green/all-at-once) |
| `fleet rollback <id>` | Rollback a deployment |
| `fleet deployments` | List deployments |
| `fleet advance <id>` | Advance canary to next stage |
| `fleet pause-deployment <id>` | Pause a deployment |
| `fleet ota <id>` | Over-the-air firmware update |
| `fleet group-create` | Create device group |
| `fleet groups` | List groups |
| `fleet group-add` | Add device to group |
| `fleet group-remove` | Remove device from group |
| `fleet group-members <id>` | List group members |
| `fleet group-scaling <id>` | Configure autoscaling |
| `fleet maintenance-create` | Schedule maintenance window |
| `fleet maintenance-list` | List maintenance windows |
| `fleet maintenance-update` | Update maintenance schedule |
| `fleet maintenance-delete` | Delete maintenance window |
| `fleet alerts` | List alerts |
| `fleet resolve-alert <id>` | Resolve an alert |
| `fleet command-queue <id>` | List pending device commands |
| `fleet agent-start <id>` | Start agentic loop on device |

### MLOps (`openeye mlops ...`)
| Command | Description |
|---------|-------------|
| `mlops retrain` | Trigger a retraining run |
| `mlops pipeline-create` | Create retraining pipeline (optional cron) |
| `mlops pipelines` | List pipelines |
| `mlops runs` | List retraining runs |
| `mlops run-status <id>` | Get run status |
| `mlops upload` | Upload custom model (ONNX/PyTorch/SafeTensors) |
| `mlops registry` | List models in enterprise registry |
| `mlops versions <model>` | Show version history |
| `mlops promote <model> <version>` | Promote to next environment |
| `mlops approve-promotion <id>` | Approve promotion |
| `mlops reject-promotion <id>` | Reject promotion |
| `mlops evaluate` | Run model evaluation |
| `mlops benchmark` | Benchmark performance |
| `mlops validate` | Validate on test set |
| `mlops validation-create` | Create validation test |
| `mlops validations` | List validation tests |
| `mlops validation-runs` | Show validation history |
| `mlops create-ab-test` | Create A/B test |
| `mlops ab-tests` | List A/B tests |
| `mlops complete-ab-test <id>` | Complete and analyze A/B test |
| `mlops shadow-mode` | Enable shadow mode |
| `mlops shadow-status` | Check shadow status |
| `mlops batch-create` | Create batch inference job |
| `mlops feedback` | Submit inference feedback |
| `mlops annotate` | Manually annotate samples |
| `mlops annotations` | List pending annotations |
| `mlops feedback-generate` | Generate synthetic feedback |
| `mlops export` | Export model in different format |
| `mlops exports` | List exports |
| `mlops lineage` | Show model lineage |

### Governance (`openeye govern ...`)
| Command | Description |
|---------|-------------|
| `govern status` | Current governance status |
| `govern ls` | List all policies |
| `govern enable <policy>` | Enable a policy |
| `govern disable <policy>` | Disable a policy |
| `govern presets` | List presets |
| `govern load <preset>` | Load preset configuration |
| `govern validate` | Validate governance config |
| `govern audit` | Show audit trail |
| `govern init` | Initialize governance |
| `govern violations` | List violations |

### Agent (`openeye agent ...`)
| Command | Description |
|---------|-------------|
| `agent run` | Run agentic perception loop locally. Options: `--model`, `--goal`, `--hz`, `--video`, `--max-ticks`, `--vlm` |
| `agent start` | Start agentic loop on running server |
| `agent stop` | Stop agentic loop on server |
| `agent status` | Show agent status |
| `agent memory` | Show recent observations |
| `agent recall <query>` | Query agent memory |

### Hosted API client (`openeye api ...`)
| Command | Description |
|---------|-------------|
| `api detect <image>` | Object detection via hosted API |
| `api describe <image>` | VLM description via hosted API |
| `api usage` | Show API usage and credits |
| `api models` | List available API models |

### Configuration
| Command | Description |
|---------|-------------|
| `openeye config get <key>` | Get config value |
| `openeye config set <key> <value>` | Set config value |

### Server utilities
| Command | Description |
|---------|-------------|
| `openeye health` | Check server health |
| `openeye nebius-stats` | Show Nebius VLM usage stats |
| `openeye server-config-get` | Get runtime server config |
| `openeye server-config-set <key> <value>` | Update server config |

### Demos
| Command | Description |
|---------|-------------|
| `openeye g1-demo` | Unitree G1 Safety Guardian demo |
| `openeye vlm-demo` | Vision Language Model demo |

---

## Environment variables
| Variable | Description |
|----------|-------------|
| `OPENEYE_SERVER_URL` | Server URL for client commands (default: `http://localhost:8000`) |
| `OPENEYE_API_URL` | Hosted API URL |
| `OPENEYE_API_KEY` | API key for hosted API |

## Piping & composition
```bash
# pipe image bytes
cat photo.jpg | openeye run yolov8 -
# chain models
openeye run yolov8 photo.jpg | openeye run depth-anything -
# save annotated output
openeye run yolov8 photo.jpg --output result.jpg
```

## MCP server (for AI tool integration)
```bash
openeye-mcp   # starts MCP server over stdio
```
Tools: openeye_list, openeye_pull, openeye_run, openeye_serve,
       openeye_health, openeye_bench, openeye_remove, openeye_nebius_stats
"""


def docs(
    machine: bool = typer.Option(
        False, "--json", "-j", help="Output as JSON for programmatic consumption"
    ),
) -> None:
    """Show full CLI reference — designed for AI agents and humans alike."""
    if machine:
        typer.echo(json.dumps({"reference": DOCS.strip()}, indent=2))
    else:
        rprint(DOCS.strip())

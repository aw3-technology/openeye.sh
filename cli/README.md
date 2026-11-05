# openeye-sh

**Ollama for vision AI models** — pull, run, and serve computer-vision models from your terminal.

## Install

```bash
pipx install openeye-sh
```

With extras:

```bash
pipx install "openeye-sh[yolo]"        # YOLO object detection
pipx install "openeye-sh[depth]"       # Monocular depth estimation
pipx install "openeye-sh[camera]"      # OpenCV camera support
pipx install "openeye-sh[mcp]"         # MCP server (openeye-mcp)
pipx install "openeye-sh[all]"         # YOLO + depth + grounding + VLM + camera
```

Other extras: `sam`, `rfdetr`, `smolvla`, `onnx`, `onnx-gpu`, `tensorrt`, `vlm`, `cloud`. Requires Python 3.12+. Quote the brackets in zsh/fish.

## Quick Start

```bash
# List available models
openeye list

# Pull a model
openeye pull yolov8

# Run inference on an image
openeye run yolov8 image.jpg

# Start the API server
openeye serve yolov8

# Live camera stream with detection
openeye watch --models yolov8

# Full command reference (add --json for machine-readable output)
openeye docs
```

## Hosted API

The `openeye api` commands call the hosted API at `https://openeye.sh/v1` (override with `OPENEYE_API_URL` or `--server`). Create a key in the [dashboard](https://openeye.sh/dashboard/settings/api-keys) and buy credits under Settings → Credits.

```bash
export OPENEYE_API_KEY=oe_your_key_here
openeye api detect photo.jpg            # 1 credit
openeye api models
openeye api usage --days 7
```

`openeye api describe` returns 503 until scene description is enabled on the hosted API, and `openeye api depth` returns 501 (depth is self-hosted only via `openeye serve depth-anything`).

## Environment Variables

| Variable | Default | Used by |
|----------|---------|---------|
| `OPENEYE_SERVER_URL` | `http://localhost:8000` | `health`, `nebius-stats`, `server-config-*`, `agent start/stop/status/memory/recall` |
| `OPENEYE_API_URL` | `https://openeye.sh` | `openeye api ...` |
| `OPENEYE_API_KEY` | — | `openeye api ...` (`oe_...` key) |
| `OPENEYE_FLEET_URL` | `http://localhost:8001` | `openeye fleet ...` (also the default `--server` for `fleet agent`) |
| `OPENEYE_DEVICE_API_KEY` | — | `openeye fleet agent` (device key, `oek_...`) |
| `OPENEYE_TOKEN` | — | `openeye fleet ...` (Better Auth session token for the fleet control plane) |
| `OPENEYE_SERVER_API_KEY` | — | `openeye serve`: if set, `/v1/*` only accepts this key |
| `CORS_ORIGINS` | openeye.sh + localhost dev ports | `openeye serve` allowed origins |
| `OPENROUTER_API_KEY` / `NEBIUS_API_KEY` | — | VLM features of `openeye serve` and `vlm-demo` |

## Features

- **Model management** — pull, list, and run vision models (YOLO, depth, grounding, SAM, RF-DETR)
- **REST & WebSocket API** — FastAPI server with `/predict`, `/v1/*`, and streaming WebSocket endpoints; the [openeye.sh dashboard](https://openeye.sh/dashboard) can connect to it
- **Hosted API client** — `openeye api` for `https://openeye.sh/v1`
- **MCP server** — `openeye-mcp` (stdio) for MCP-capable agents
- **Live perception** — real-time camera inference with VLM reasoning
- **Fleet management** — `openeye fleet` client and device agent for the self-hosted fleet control plane
- **Agentic loop** — continuous perception + reasoning + planning pipeline
- **Safety guardian** — configurable safety zone monitoring for robotics

## Links

- [Homepage](https://openeye.sh)
- [Documentation](https://openeye.sh/docs)
- [Repository](https://github.com/aw3-technology/openeye.sh)

# CLI Commands

OpenEye provides five core commands.

## `openeye pull <model>`

Download model weights from HuggingFace Hub.

```bash
openeye pull yolov8
openeye pull depth-anything
openeye pull grounding-dino
```

**Options:**

- `--variant <name>` — Pull a specific variant (e.g., `quantized`)
- `--force` — Re-download even if already present

## `openeye run <model> <image>`

Run inference on a single image and print JSON results.

```bash
openeye run yolov8 photo.jpg
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
```

**Options:**

- `--prompt <text>` — Text prompt for open-vocabulary models
- `--output <path>` — Write results to a file instead of stdout
- `--pretty` — Pretty-print JSON output

## `openeye serve <model>`

Start a FastAPI inference server.

```bash
openeye serve yolov8
openeye serve yolov8 --port 9000
```

**Options:**

- `--host <addr>` — Bind address (default: `0.0.0.0`)
- `--port <num>` — Port number (default: `8000`)
- `--variant <name>` — Serve a specific variant

## `openeye list`

List all registered models and their download status.

```bash
openeye list
```

Output shows model name, task, size, and whether it's downloaded.

## `openeye config`

View or set configuration values.

```bash
openeye config get default_model
openeye config set default_model yolov8
```

Configuration is stored in `~/.openeye/config.yaml`.

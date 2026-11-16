---
name: openeye-run
description: Execute OpenEye CLI commands — pull models, run inference, benchmark, serve, and manage the vision AI stack.
argument-hint: "<command or workflow to run>"
allowed-tools: Bash, Read
---

# OpenEye CLI Operator

Execute OpenEye CLI commands. The CLI is normally installed globally (`pipx install openeye-sh`). In this repo you can also run it without installing: `uv run --directory cli openeye <command>`.

## Binary Path

```bash
openeye <command> [args...]
openeye docs            # full reference, generated from the installed CLI (--json for machine-readable)
```

## Workflow Chains

These work the same on macOS, Linux and Windows (PowerShell). `openeye run` writes JSON to stdout and progress/status messages to stderr, so use `-o/--output` to capture clean JSON instead of shell redirection.

### Pull → Run → Interpret

```bash
openeye pull <model>
openeye run <model> <image> -o result.json
```

Read `result.json` (`PredictionResult`) and summarize the detections for the user. `--pretty` prints a human-readable summary instead (to stderr; the JSON still goes to stdout).

### Benchmark a Model

```bash
openeye pull <model>
openeye bench <model> --runs 20
```

Report mean, median, P95, min/max latency and FPS.

### Serve + Health Check

Start the server as a background job with your Bash tool's background option (do not append `&` or `sleep`), then poll until it answers:

```bash
openeye serve <model> --port 8000
openeye health --server http://localhost:8000
```

`openeye health` (or `curl http://localhost:8000/health`) fails with a connection error until the model has loaded. Confirm the server is healthy before telling the user it's ready.

### Compare Models

```bash
openeye run yolov8 image.jpg -o result_yolov8.json
openeye run grounding-dino image.jpg -p "person . car . dog" -o result_grounding.json
```

Compare detection counts, labels, and confidence scores side by side.

## Output Parsing

### `openeye run` — JSON (`PredictionResult`, `cli/openeye_ai/schema.py`)

```json
{
  "model": "yolov8",
  "task": "detection",
  "timestamp": "2026-11-16T12:00:00.000000+00:00",
  "image": {"width": 640, "height": 480, "source": "image.jpg"},
  "objects": [
    {"label": "person", "confidence": 0.92, "bbox": {"x": 0.16, "y": 0.10, "w": 0.31, "h": 0.73}},
    {"label": "car", "confidence": 0.87, "bbox": {"x": 0.62, "y": 0.42, "w": 0.31, "h": 0.31}}
  ],
  "depth_map": null,
  "segmentation_masks": null,
  "vla_action": null,
  "inference_ms": 23.4
}
```

`bbox` is normalized 0-1: `x`,`y` are the top-left corner, `w`,`h` the size. Multiply by `image.width`/`image.height` for pixels. Depth models fill `depth_map` (base64 PNG), `sam2` fills `segmentation_masks`, `smolvla` fills `vla_action`.

### `openeye list` — Rich table

Columns: Model, Task, Description, Size, Hardware, Variants, Status. Use `openeye list --json` when you need to parse it.

### `openeye bench` — Rich table

Columns: Metric, Value. Rows: Mean, Median, Std Dev, Min, Max, P95, FPS.

### `GET /health` (via curl)

```json
{"status": "ok", "model": "yolov8", "model_display_name": "YOLOv8", "task": "detection",
 "model_loaded": true, "uptime_seconds": 42.5, "queue": {"active": 0, "queued": 0}}
```

## Safety Rules

1. **No delete without confirmation** — never run `openeye remove <model>` without asking the user first.
2. **No privileged ports** — don't bind to ports below 1024 unless explicitly requested.
3. **Check disk space** — before pulling the larger models (`smolvla` ~500 MB, `grounding-dino` ~341 MB, `sam2` ~150 MB, `rfdetr` ~120 MB; see `openeye list`), warn the user. The extras they need (torch, transformers) are much larger than the weights.
4. **Don't kill unrelated processes** — when stopping `openeye serve`, only stop the background job you started.
5. **Stderr is noisy** — capture JSON with `-o result.json` (or read stdout only) rather than parsing combined output.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Unknown model 'x'` | Not a registry key | `openeye list` (keys use hyphens, e.g. `depth-anything`) |
| `Model 'x' not downloaded` | Weights not pulled | `openeye pull x` |
| `Missing dependencies for 'x'` | Missing extra | `pipx install "openeye-sh[yolo]"` (see the extra column below) |
| Connection refused on `:8000` | Server not running | `openeye serve <model>` |
| `CUDA out of memory` | GPU memory exhausted | Use a smaller model, or an exported model with `--backend onnx` |
| `Image not found: <path>` | Bad image path | Verify the file exists |
| Download failed | Network / Hugging Face issue | Retry; set `HF_TOKEN` if the model is gated |

## Available Models

Keys from `cli/openeye_ai/models.yaml`:

| Model | Key | Task | Install Extra |
|-------|-----|------|---------------|
| YOLOv8 | `yolov8` | Object detection | `yolo` |
| YOLO26 | `yolo26` | Object detection | `yolo` |
| Depth Anything V2 | `depth-anything` | Monocular depth | `depth` |
| Grounding DINO | `grounding-dino` | Open-vocab detection (`-p` prompt) | `grounding` |
| SAM 2 | `sam2` | Segmentation | `sam` |
| RF-DETR | `rfdetr` | Detection | `rfdetr` |
| SmolVLA | `smolvla` | Vision-language-action | `smolvla` |

ONNX and TensorRT are backends, not models: install `openeye-sh[onnx]` or `openeye-sh[tensorrt]` and pass `--backend onnx` / `--backend tensorrt` to `openeye run`.

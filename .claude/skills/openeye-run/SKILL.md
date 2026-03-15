---
name: openeye-run
description: Execute OpenEye CLI commands — pull models, run inference, benchmark, serve, and manage the vision AI stack.
argument-hint: "<command or workflow to run>"
allowed-tools: Bash, Read
---

# OpenEye CLI Operator

Execute OpenEye CLI commands using the virtual environment at `cli/.venv`.

## Binary Path

```bash
OPENEYE=cli/.venv/bin/openeye
```

Always use this path. Never rely on a global `openeye` install.

## Workflow Chains

### Pull → Run → Interpret

```bash
cli/.venv/bin/openeye pull <model>
cli/.venv/bin/openeye run <model> <image> 2>/dev/null
```

Parse the JSON output (`PredictionResult`), summarize detections for the user.

### Benchmark a Model

```bash
cli/.venv/bin/openeye pull <model>
cli/.venv/bin/openeye bench <model> --runs 20
```

Report mean/p50/p95/p99 latency and throughput.

### Serve + Health Check

```bash
cli/.venv/bin/openeye serve <model> --port 8000 &
sleep 3
curl -sf http://localhost:8000/health
```

Confirm the server is healthy before telling the user it's ready.

### Compare Models

```bash
cli/.venv/bin/openeye run yolov8 image.jpg 2>/dev/null > /tmp/result_a.json
cli/.venv/bin/openeye run grounding_dino image.jpg -p "find objects" 2>/dev/null > /tmp/result_b.json
```

Compare detection counts, classes, and confidence scores side by side.

## Output Parsing

### `openeye run` — JSON (`PredictionResult`)

```json
{
  "model": "yolov8",
  "inference_ms": 23.4,
  "image_size": [640, 480],
  "detections": [
    {"class": "person", "confidence": 0.92, "bbox": [100, 50, 300, 400]},
    {"class": "car", "confidence": 0.87, "bbox": [400, 200, 600, 350]}
  ]
}
```

### `openeye list` — Rich table

Columns: Model, Task, Status (downloaded/available), Size, Adapter.

### `openeye bench` — Rich table

Columns: Metric, Value. Rows: mean, p50, p95, p99, throughput (fps).

### `openeye health` (via curl)

```json
{"status": "ok", "model": "yolov8", "uptime": 42.5}
```

## Safety Rules

1. **No delete without confirmation** — never run `openeye remove <model>` without asking the user first.
2. **No privileged ports** — don't bind to ports below 1024 unless explicitly requested.
3. **Check disk space** — before pulling large models (depth_anything ~1.5GB, grounding_dino ~1.8GB), warn the user.
4. **Don't kill unrelated processes** — when stopping `openeye serve`, only kill the PID you started.
5. **Stderr is noisy** — redirect stderr with `2>/dev/null` when capturing JSON output from `run`.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Model 'x' not found` | Model not downloaded | `openeye pull x` |
| `No adapter found for 'x'` | Missing extra dependency | `pip install openeye-sh[yolo]` (check model table) |
| `Connection refused :8000` | Server not running | `openeye serve <model>` |
| `CUDA out of memory` | GPU memory exhausted | Try `--device cpu` or a smaller model |
| `FileNotFoundError: <image>` | Bad image path | Verify file exists with `ls` |
| `Download failed` | Network / HuggingFace issue | Retry, check `HF_TOKEN` if gated model |

## Available Models

| Model | Key | Task | Install Extra |
|-------|-----|------|---------------|
| YOLOv8 | `yolov8` | Object detection | `yolo` |
| Depth Anything | `depth_anything` | Monocular depth | `depth` |
| Grounding DINO | `grounding_dino` | Open-vocab detection | `grounding` |
| ONNX Generic | `onnx_generic` | Various | `onnx` |
| TensorRT | `tensorrt_generic` | Various | `tensorrt` |
| RF-DETR | `rfdetr` | Detection | `rfdetr` |
| SmolVLA | `smolvla` | Vision-language-action | `smolvla` |

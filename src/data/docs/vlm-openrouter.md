---
title: VLM via OpenRouter
---

Send images to free Vision Language Models through OpenRouter for scene understanding, hazard detection, and visual reasoning.

### Setup

Add your OpenRouter API key to `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys).

Install dependencies:

```bash
pip install openai Pillow
```

### Available Models

| Model ID | Name | Parameters | Cost |
|----------|------|------------|------|
| `qwen/qwen3-vl-235b:free` | Qwen3-VL 235B | 235B | Free |
| `qwen/qwen2.5-vl-72b-instruct:free` | Qwen2.5-VL 72B | 72B | Free |
| `google/gemma-3-27b-it:free` | Gemma 3 27B | 27B | Free |

### CLI Usage

```bash
# Analyse default warehouse scene
openeye vlm-demo

# Custom image
openeye vlm-demo --image photo.jpg

# Custom prompt
openeye vlm-demo --prompt "List every safety hazard you see"

# Pick a different model
openeye vlm-demo --model google/gemma-3-27b-it:free

# Compare all free models side-by-side
openeye vlm-demo --all-models
```

### Options

| Flag | Description |
|------|-------------|
| `--image` | Path to image file (default: `src/assets/demo/scene-warehouse.jpg`) |
| `--model`, `-m` | OpenRouter model ID (default: `qwen/qwen3-vl-235b:free`) |
| `--prompt`, `-p` | Custom prompt to send with the image |
| `--all-models` | Compare all free VLM models concurrently |

### Standalone Usage

Run directly without the CLI:

```bash
cd cli
python -m openeye_ai.demos.vlm_openrouter_demo
python -m openeye_ai.demos.vlm_openrouter_demo --all-models
```

### Integration with the Full Pipeline

The VLM demo uses the same OpenRouter provider as the live pipeline. In production, the server's `/ws/vlm` WebSocket endpoint streams VLM reasoning alongside YOLO detections:

1. **Detection** — YOLO finds objects at ~30 FPS
2. **VLM Reasoning** — OpenRouter VLM analyses keyframes for scene understanding
3. **Agentic Loop** — combines both for planning and decision-making

The `vlm-demo` command isolates step 2 for testing and prompt iteration.

### API Details

Requests use the OpenAI-compatible chat completions endpoint at `https://openrouter.ai/api/v1`. Images are resized to max 1024px and sent as base64 JPEG with `detail: "low"` to keep payloads small. Required headers:

- `HTTP-Referer: https://perceptify.dev`
- `X-Title: OpenEye`

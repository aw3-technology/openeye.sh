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

Or export it in your shell; vlm-demo reads a .env file from the repository root when run from a checkout.

Install the VLM client (the openai package):

```bash
pipx install "openeye-sh[vlm]" --force
```

### Available Models

| Model ID | Name | Parameters | Cost |
|----------|------|------------|------|
| `nvidia/nemotron-3.5-super-vl:free` | Nemotron 3.5 Super VL (default) | — | Free |
| `google/gemma-4-31b-it:free` | Gemma 4 31B | 31B | Free |
| `qwen/qwen3-vl-235b-a22b-instruct` | Qwen3-VL 235B A22B | 235B (22B active) | Paid |

Free OpenRouter models are rate limited and come and go; any other OpenRouter vision model ID also works with `--model`.

### CLI Usage

```bash
# Analyse default warehouse scene
openeye vlm-demo

# Custom image
openeye vlm-demo --image photo.jpg

# Custom prompt
openeye vlm-demo --prompt "List every safety hazard you see"

# Pick a different model
openeye vlm-demo --model google/gemma-4-31b-it:free

# Compare the three models above side-by-side
openeye vlm-demo --all-models
```

### Options

| Flag | Description |
|------|-------------|
| `--image` | Path to image file (default: `src/assets/demo/scene-warehouse.jpg`) |
| `--model`, `-m` | OpenRouter model ID (default: `nvidia/nemotron-3.5-super-vl:free`) |
| `--prompt`, `-p` | Custom prompt to send with the image |
| `--all-models` | Run the three models above concurrently |

### Standalone Usage

Run directly without the CLI:

```bash
cd cli
python -m openeye_ai.demos.vlm_openrouter_demo
python -m openeye_ai.demos.vlm_openrouter_demo --all-models
```

### Integration with the Full Pipeline

The VLM demo uses the same OpenRouter provider as the live pipeline. In production, the server's `/ws/vlm` WebSocket endpoint streams VLM reasoning alongside YOLO detections:

- 1. **Detection** — YOLO finds objects at ~30 FPS
- 2. **VLM Reasoning** — OpenRouter VLM analyses keyframes for scene understanding
- 3. **Agentic Loop** — combines both for planning and decision-making

The `vlm-demo` command isolates step 2 for testing and prompt iteration.

### API Details

Requests use the OpenAI-compatible chat completions endpoint at `https://openrouter.ai/api/v1`. Images are resized to max 1024px and sent as base64 JPEG with `detail: "low"` to keep payloads small. Required headers:

- `HTTP-Referer: https://openeye.sh`
- `X-Title: OpenEye`

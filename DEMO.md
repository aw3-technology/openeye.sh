# OpenEye Demo — Nebius Token Factory

> Real-time perception engine powered by Nebius Token Factory.
> YOLO detection + VLM reasoning + agentic planning — all running on Nebius infrastructure.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Python 3.12+ | With pipx |
| Node.js 18+ | For frontend |
| Webcam | Built-in laptop camera works |
| Nebius API Key | From [Nebius Console](https://console.nebius.com) |

## Quick Start (< 2 minutes)

### 1. Configure Environment

```bash
# Set your Nebius Token Factory key
cat > backend/.env << 'EOF'
NEBIUS_API_KEY=<your-key>
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
CAMERA_INDEX=0
EOF
```

### 2. Install & Start Backend

```bash
# Install CLI via pipx
pipx install -e cli/

# Start server with Nebius VLM + LLM
source backend/.env && export NEBIUS_API_KEY NEBIUS_BASE_URL && \
openeye serve yolov8 --demo \
  --vlm-model "Qwen/Qwen2.5-VL-72B-Instruct" \
  --cortex-llm "Qwen/Qwen3-235B-A22B-Instruct-2507" \
  --port 8000
```

You should see:
```
  Warm-up complete: 5 passes, mean ~85 ms (12 FPS)
╭─────────────────────────────── OpenEye Server ───────────────────────────────╮
│ * YOLOv8 ready on http://0.0.0.0:8000                                       │
│   Demo mode — model is warm, zero cold-start                                │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### 3. Start Frontend

```bash
npm run dev
# → http://localhost:5173
```

---

## Demo Flow

### Act 1: Live Camera + VLM Reasoning

**Open:** `http://localhost:5173/dashboard/livestream`

This is the flagship view. It shows:

- **Left panel (60%):** Live camera feed with YOLO detection overlays. Bounding boxes drawn in real-time at 10-15 FPS. Each detected object shows class label + confidence score.
- **Right panel (40%):**
  - **Detection List** — live object inventory with confidence bars and badges (HAZARD, PERSON)
  - **Safety Log** — proximity zone monitoring (DANGER / CAUTION / SAFE)
  - **Scene Graph** — spatial relationships between detected objects
- **Bottom panel:** VLM Reasoning tab labeled **"Nebius Token Factory"** — Qwen2.5-VL-72B analyzes frames every few seconds with typewriter-effect output

**What to show judges:**
1. Click "Start Camera" — YOLO detections appear instantly (<100ms)
2. Point camera at objects/people — watch detections update in real-time
3. Click the "VLM Reasoning" tab — see Nebius-powered scene analysis with latency stats
4. Note the dual-speed architecture: fast YOLO (~85ms) + deep VLM reasoning (~2-3s)

### Act 2: Agentic Loop

**Open:** `http://localhost:5173/dashboard/agentic`

The agentic loop runs continuously:
1. **Perceive** — YOLO detection every frame
2. **Reason** — Nebius VLM analyzes the scene every 3 seconds
3. **Plan** — Nebius LLM (Qwen3-235B) generates an action plan

**What to show judges:**
- Set a goal like "Identify all hazards" or "Find the nearest person"
- Watch the system perceive → reason → plan in a continuous loop
- Highlight that both VLM and LLM are running on Nebius Token Factory

### Act 3: Nebius Stats

**Terminal:**
```bash
openeye nebius-stats
```

Shows a Rich-formatted table with:
- Total VLM API calls
- Estimated tokens consumed
- Average latency
- Model name (`Qwen/Qwen2.5-VL-72B-Instruct`)
- Provider: **Nebius Token Factory**

**Dashboard:** `http://localhost:5173/dashboard` (Overview page)
- Nebius Token Factory section with 4 live metrics:
  - VLM Calls, Tokens Used, Avg Latency, Success Rate
- Polls `/nebius/stats` every 5 seconds

---

## Nebius Models Used

| Model | Purpose | Type |
|-------|---------|------|
| `Qwen/Qwen2.5-VL-72B-Instruct` | Vision-language scene analysis | VLM |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` | Agentic reasoning & planning | LLM |
| `meta-llama/Llama-Guard-3-8B` | Content safety moderation | Safety |
| `Qwen/Qwen3-Embedding-8B` | Knowledge base RAG embeddings | Embedding |

All accessed via **OpenAI-compatible API** at `api.tokenfactory.nebius.com/v1/`.

## Architecture

```
Camera Frame
    │
    ├──→ YOLOv8 (local, <100ms)
    │       → bounding boxes, classes, confidence
    │
    └──→ Nebius Token Factory
            │
            ├──→ Qwen2.5-VL-72B (VLM, ~2-3s)
            │       → scene description, safety analysis
            │
            ├──→ Qwen3-235B (LLM, ~1-2s)
            │       → reasoning, action planning
            │
            └──→ Llama Guard 3 (Safety)
                    → content moderation
```

**Dual-brain architecture:** Fast local YOLO for real-time detection + Nebius cloud VLM/LLM for deep understanding. The local model never blocks on the cloud model — they run in parallel.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status + uptime |
| `/predict` | POST | Single image inference |
| `/ws` | WebSocket | Real-time YOLO detection stream |
| `/ws/vlm` | WebSocket | Nebius VLM reasoning (base64 frames) |
| `/ws/perception` | WebSocket | Full perception pipeline |
| `/ws/agentic` | WebSocket | Agentic loop (perceive + reason + plan) |
| `/nebius/stats` | GET | Nebius Token Factory usage metrics |
| `/metrics` | GET | Prometheus metrics |

## CLI Commands

```bash
# List available models
openeye list

# Run inference on an image
openeye run yolov8 image.jpg

# Start server with Nebius VLM
openeye serve yolov8 --vlm-model "Qwen/Qwen2.5-VL-72B-Instruct"

# Live camera watch with safety monitoring
openeye watch yolov8 --safety

# Check Nebius usage stats
openeye nebius-stats

# Agentic loop with VLM
openeye agent --vlm

# G1 Safety Guardian demo (Rich terminal UI)
openeye g1-demo --demo
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `VLM not configured` | Check `NEBIUS_API_KEY` is exported in the server's env |
| `Model does not exist` | Use `Qwen/Qwen2.5-VL-72B-Instruct` (not `Qwen3-VL-72B`) |
| `Non-base64 digit found` | VLM WebSocket expects raw base64 string, not JSON wrapper |
| Wrong base URL | Set `NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/` |
| `python-multipart` error | Run `pipx inject openeye-sh python-multipart` |
| Frontend port conflict | Vite auto-increments ports (5173 → 5174 → ...) |
| Camera not found | Set `CAMERA_INDEX=0` in `.env` or try `1` for external camera |

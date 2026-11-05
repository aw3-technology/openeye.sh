---
title: openeye agent
---

Agentic perception loop — continuously perceive, reason, and act. The agent maintains observation memory and can use VLM reasoning to pursue goals.

### Subcommands

| Command | Description |
|---------|-------------|
| agent run | Run the agentic loop locally on camera or video |
| agent start | Start the agentic loop on a running server |
| agent stop | Stop the agentic loop on a running server |
| agent status | Show agent status (running, tick count, plan, goal) |
| agent memory | Show recent observations from memory |
| agent recall QUERY | Query memory with natural language |

### Local Agent Loop

```bash
openeye agent run --model yolov8 --goal "monitor workspace safety"
openeye agent run --model yolov8 --video demo.mp4 --max-ticks 20
openeye agent run --vlm
```

| Flag | Description |
|------|-------------|
| --model, -m <name> | Detection model (default: yolov8) |
| --goal, -g <text> | Goal for the agent to pursue (default: "monitor the scene") |
| --hz <float> | Loop frequency in Hz (default: 1.0) |
| --video <path> | Video file input (fallback if no camera) |
| --max-ticks <n> | Stop after N ticks (default: run until stopped) |
| --vlm | Enable VLM reasoning. Uses NEBIUS_MODEL (default Qwen/Qwen2.5-VL-72B-Instruct) with NEBIUS_API_KEY; a lowercase OpenRouter-style model ID uses OPENROUTER_API_KEY instead |

### Server Agent Control

These talk to a running openeye serve at OPENEYE_SERVER_URL (default http://localhost:8000) unless you pass --server, -s <url>.

```bash
openeye agent start --goal "detect hazards"
openeye agent stop
openeye agent status
```

| Command | Flags |
|---------|-------|
| agent start | --goal, -g <text> (default: "monitor the scene"), --server, -s |
| agent stop | --server, -s |
| agent status | --server, -s |

### Memory Queries

```bash
openeye agent memory --limit 10
openeye agent recall "when did a person enter the workspace?"
```

| Command | Flags |
|---------|-------|
| agent memory | --limit, -n <n> (default: 10), --server, -s |
| agent recall QUERY | --limit, -n <n> (default: 5), --server, -s |

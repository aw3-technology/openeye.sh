---
title: openeye agent
---

Agentic perception loop — continuously perceive, reason, and act. The agent maintains observation memory and uses VLM reasoning to pursue goals.

### Subcommands

| Command | Description |
|---------|-------------|
| agent run | Run the agentic loop locally on camera or video |
| agent start | Start the agentic loop on a running server |
| agent stop | Stop the agentic loop on a running server |
| agent status | Show agent status (running, tick count, plan, goal) |
| agent memory | Show recent observations from memory |
| agent recall | Query memory with natural language |

### Local Agent Loop

```bash
openeye agent run --model yolov8 --goal "monitor workspace safety"
openeye agent run --model yolov8 --video demo.mp4 --max-ticks 20
openeye agent run --model yolov8 --vlm Qwen/Qwen3-VL-72B
```

| Flag | Description |
|------|-------------|
| --model <name> | Detection model (default: yolov8) |
| --goal <text> | Goal for the agent to pursue |
| --hz <float> | Tick frequency in Hz |
| --video <path> | Video file input instead of camera |
| --max-ticks <n> | Maximum ticks before stopping |
| --vlm <id> | VLM model for reasoning |

### Server Agent Control

```bash
openeye agent start --goal "detect hazards"
openeye agent stop
openeye agent status
```

### Memory Queries

```bash
openeye agent memory --limit 10
openeye agent recall "when did a person enter the workspace?"
```

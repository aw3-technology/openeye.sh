---
title: "How to Give Claude Vision with MCP: Local Object Detection in Two Commands"
excerpt: "Language models can read images, but they can't count objects precisely, measure depth, or run on a camera feed. Here's how to connect Claude (or Cursor, or any MCP client) to real computer-vision models running on your own machine with OpenEye's MCP server."
date: "2026-11-16"
author: "OpenEye Team"
category: "Tutorial"
readTime: "6 min read"
---

Multimodal models like Claude can look at a photo and tell you what's in it. What they can't do on their own is give you pixel-accurate bounding boxes, a depth map, a segmentation mask, or 30 detections per second off a webcam. That's what dedicated vision models like YOLO, Depth Anything, and SAM 2 are for.

The Model Context Protocol (MCP) lets an agent call tools that run on your machine. OpenEye ships an MCP server, `openeye-mcp`, so your agent can pull and run those vision models locally and get structured JSON back.

This guide takes about five minutes.

## Step 1: Install OpenEye with the MCP extra

```bash
pipx install "openeye-sh[mcp,yolo]"
```

The `mcp` extra adds the server. The `yolo` extra adds the YOLO detection backend. Quote the brackets in zsh and fish.

## Step 2: Register the server with your agent

**Claude Code:**

```bash
claude mcp add openeye -- openeye-mcp
```

**Claude Desktop:** open Settings → Developer → Edit Config, add the server to `claude_desktop_config.json`, then restart the app:

```json
{
  "mcpServers": {
    "openeye": { "command": "openeye-mcp" }
  }
}
```

If the app can't find the command, use the full path printed by `which openeye-mcp`. Cursor, Windsurf, and other MCP clients use the same `command` entry in their own MCP config files.

## Step 3: Ask for something

```text
Pull yolov8, run it on ~/Pictures/desk.jpg, and tell me how many objects you found and where they are.
```

Behind the scenes the agent calls `openeye_pull` to download the weights once, then `openeye_run` on the image. It gets back a structured result instead of a guess (abbreviated):

```json
{
  "model": "yolov8",
  "task": "detection",
  "image": { "width": 1280, "height": 960, "source": "desk.jpg" },
  "objects": [
    { "label": "laptop", "confidence": 0.94, "bbox": { "x": 0.21, "y": 0.33, "w": 0.48, "h": 0.41 } },
    { "label": "cup", "confidence": 0.88, "bbox": { "x": 0.74, "y": 0.52, "w": 0.09, "h": 0.15 } }
  ],
  "inference_ms": 38.2
}
```

Bounding boxes are normalized (0–1), so the agent can reason about position ("the cup is to the right of the laptop") without knowing the image resolution.

## What tools the agent gets

| Tool | What it does |
|------|--------------|
| `openeye_list` | List installed and available models |
| `openeye_pull` | Download a model's weights |
| `openeye_run` | Run inference on an image and return JSON |
| `openeye_serve` | Start a REST and WebSocket server for a model |
| `openeye_health` | Check a running server |
| `openeye_bench` | Benchmark a model's latency on your hardware |
| `openeye_remove` | Delete a downloaded model |

With an `OPENEYE_API_KEY` set, the agent also gets hosted tools (`openeye_api_detect`, `openeye_api_models`, `openeye_api_usage`). These run detection on the hosted API at `https://openeye.sh/v1`, so nothing has to be installed on the machine running the agent.

## Beyond detection

The same server works for every model in the [registry](/models):

- **Depth:** "Run depth-anything on hallway.png and tell me which side of the hallway is closer."
- **Open-vocabulary detection:** "Use grounding-dino to find every red cup in kitchen.jpg."
- **Segmentation:** "Segment the person in portrait.jpg with sam2."
- **Benchmarking:** "Benchmark yolov8 and rfdetr on this machine and tell me which one to use for a 30 fps camera."

Each model needs its extra (`depth`, `grounding`, `sam`, `rfdetr`). Install them all with `pipx install "openeye-sh[all,mcp]"`.

## Why run vision locally?

- **Privacy:** images never leave your machine.
- **Cost:** a local YOLO run costs nothing, and it's fast enough for a live camera.
- **Precision:** a detector gives exact boxes and confidence scores. Agents can count, filter, and threshold them reliably.
- **Composability:** the same models serve REST and WebSocket APIs with `openeye serve`, so a prototype you build with an agent can become a real service.

## Next steps

- [Claude Skill and MCP setup guide](/docs/claude-skill)
- [`openeye run` reference](/docs/cli-run)
- [Hosted API quickstart](/docs/quickstart)
- Star the project on [GitHub](https://github.com/aw3-technology/openeye.sh) if this was useful, and open an issue if a model you need is missing.

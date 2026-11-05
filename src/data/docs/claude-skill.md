---
title: Try It Out — OpenEye Claude Skill
---

The OpenEye Claude Skill lets you use Claude (via Claude Code or the Claude Desktop app with MCP) as a copilot for your vision AI workflows. Ask Claude to pull models, run inference, manage fleets, and more — all through natural language.

## What is a Claude Skill?

A Claude Skill is a structured knowledge file that teaches Claude about a specific tool or API. When loaded, Claude can understand OpenEye's CLI commands, API endpoints, model registry, and architecture — letting it write correct commands and code on your behalf.

## Prerequisites

- **Claude Code** (CLI), or **Claude Desktop** / another MCP client for the MCP server
- **OpenEye CLI** installed (`pipx install openeye-sh`)
- A terminal or development environment

## Setup — Claude Code

### Step 1: Clone the OpenEye repo

```bash
git clone https://github.com/aw3-technology/openeye.sh.git
cd openeye.sh
```

### Step 2: Start Claude Code

```bash
claude
```

Claude Code automatically discovers the `.claude/` directory in the project root, which contains the OpenEye skill files. No extra configuration needed.

### Step 3: Verify it works

Ask Claude:

```text
What OpenEye models are available and how do I pull one?
```

Claude will reference the skill files and give you accurate, project-specific answers.

## Setup — MCP Server (Claude Desktop and other MCP clients)

The CLI ships an MCP server, openeye-mcp, that lets Claude call OpenEye directly: list, pull, and remove models, run inference on an image, start a server, check its health, benchmark, and read Nebius stats. It runs over stdio on your machine.

### Step 1: Install with the mcp extra

```bash
pipx install "openeye-sh[mcp]"
```

### Step 2: Register the server

Claude Code:

```bash
claude mcp add openeye -- openeye-mcp
```

Claude Desktop — add it to claude_desktop_config.json (Settings → Developer → Edit Config), then restart the app:

```json
{
  "mcpServers": {
    "openeye": { "command": "openeye-mcp" }
  }
}
```

If Claude Desktop can't find the command, use the full path from which openeye-mcp.

### Step 3: Ask for something

```text
List the OpenEye models and run yolov8 on ~/Pictures/desk.jpg
```

## Example Prompts

Here are things you can ask Claude with the OpenEye skill loaded:

### Model Management

```text
Pull the YOLOv8 model and run inference on photo.jpg
```

```text
What quantized model variants are available?
```

```text
Benchmark the depth-anything model with 50 runs
```

### Server & API

```text
Start serving YOLOv8 on port 8000 and show me how to call the predict endpoint with curl
```

```text
Write a Python script that connects to the OpenEye WebSocket and streams camera frames
```

### Fleet Management

```text
Register a new camera device called "lobby-cam" and deploy YOLOv8 to it with a canary strategy
```

```text
Show me all online devices in my fleet
```

### MLOps

```text
Upload my custom ONNX model and set up an A/B test between v1 and v2
```

```text
Export the YOLOv8 model to TensorRT with quantization
```

### Architecture & Debugging

```text
Explain the perception pipeline and how plugins are loaded
```

```text
I'm getting "Connection refused :8001" — help me debug this
```

## Skill File Structure

The skill is organized under `.claude/` in the OpenEye repository:

```text
.claude/
  skills/
    openeye/
      SKILL.md              # Skill entry point: overview & quick reference
      CLI_REFERENCE.md      # All CLI commands with options
      API_REFERENCE.md      # Server endpoints, TypeScript clients, hooks
      ARCHITECTURE.md       # Backend pipeline, mode system, plugins
    openeye-run/
      SKILL.md              # /openeye-run: execute OpenEye CLI workflows
```

> [!info] Claude Code reads these files automatically when working in the OpenEye project directory. You don't need to paste documentation into your prompts.

## Tips for Best Results

- **Be specific** — Instead of "run a model," say "run YOLOv8 on image.png with pretty output"
- **Chain tasks** — "Pull depth-anything, benchmark it, then start serving it on port 9000"
- **Ask for code** — "Write a JavaScript client that calls the /predict endpoint and displays bounding boxes on a canvas"
- **Debug with context** — Paste error messages and ask Claude to diagnose using its knowledge of OpenEye's error codes and architecture
- **Reference the docs** — "According to the OpenEye API reference, what query parameters does /predict accept?"

## What Claude Can Help With

| Task | Example |
|------|---------|
| Install & setup | "Install OpenEye with all extras on Ubuntu" |
| Run inference | "Detect objects in this image using Grounding DINO with the prompt 'red car'" |
| Build integrations | "Write a FastAPI webhook that receives OpenEye detections and sends Slack alerts" |
| Fleet operations | "Deploy model v2.0 to all online cameras with rolling strategy" |
| Performance tuning | "Compare YOLOv8 vs YOLOv8-quantized latency on my hardware" |
| Custom adapters | "Create a custom adapter for my ONNX segmentation model" |

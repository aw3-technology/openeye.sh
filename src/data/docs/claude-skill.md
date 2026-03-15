---
title: Try It Out — OpenEye Claude Skill
---

The OpenEye Claude Skill lets you use Claude (via Claude Code or the Claude Desktop app with MCP) as a copilot for your vision AI workflows. Ask Claude to pull models, run inference, manage fleets, and more — all through natural language.

## What is a Claude Skill?

A Claude Skill is a structured knowledge file that teaches Claude about a specific tool or API. When loaded, Claude can understand OpenEye's CLI commands, API endpoints, model registry, and architecture — letting it write correct commands and code on your behalf.

## Prerequisites

- **Claude Code** (CLI) or **Claude Desktop** with MCP support
- **OpenEye CLI** installed (`pip install openeye-ai`)
- A terminal or development environment

## Setup — Claude Code

### Step 1: Clone the OpenEye repo

```bash
git clone https://github.com/AW3-ai/openeye.git
cd openeye
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

## Setup — Claude Desktop (MCP)

### Step 1: Add the OpenEye skill as a project

Open Claude Desktop, create a new Project, and add the OpenEye repository folder as project context. Claude will read the `.claude/` directory and load the skill.

### Step 2: Chat with context

Once the project is loaded, Claude has full knowledge of OpenEye's CLI, API, and architecture.

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
Benchmark the depth_anything model with 50 runs
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
      OVERVIEW.md           # Project summary & quick reference
      CLI_REFERENCE.md      # All CLI commands with options
      API_REFERENCE.md      # Server endpoints, TypeScript clients, hooks
      ARCHITECTURE.md       # Backend pipeline, mode system, plugins
```

> [!info] Claude reads these files automatically when working in the OpenEye project directory. You don't need to paste documentation into your prompts.

## Tips for Best Results

- **Be specific** — Instead of "run a model," say "run YOLOv8 on image.png with pretty output"
- **Chain tasks** — "Pull depth_anything, benchmark it, then start serving it on port 9000"
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

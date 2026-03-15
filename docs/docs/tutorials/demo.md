# Interactive CLI Demo

An interactive walkthrough that runs real OpenEye commands against sample images. Use it for evaluating the tool, onboarding, or live presentations.

## Prerequisites

- **Python 3.12** (torch requires <=3.12)
- **jq** (optional, for JSON pipeline steps — `brew install jq`)
- **curl** (for the API server step)

## Setup

```bash
# Create a virtual environment with Python 3.12
python3.12 -m venv .venv

# Install the CLI with YOLO and camera support
.venv/bin/pip install -e "./cli[yolo,camera]"

# Pull the YOLOv8 model (6 MB)
.venv/bin/openeye pull yolov8
```

## Run the Demo

```bash
./demo.sh
```

The demo is interactive — press **Enter** to advance between steps. Each step shows the command being run and its live output.

## What the Demo Covers

| Step | Command | What it demonstrates |
|------|---------|----------------------|
| 1 | `openeye list` | Browse the model registry (7 vision models) |
| 2 | `openeye pull yolov8` | Download a model — like `ollama pull` |
| 3 | `openeye run yolov8 scene-warehouse.jpg --pretty` | Object detection with structured JSON output |
| 4 | `openeye run yolov8 scene-kitchen.jpg --pretty` | Detection on a different scene (apple, cup, donut) |
| 5 | `openeye run ... --visualize` | Save an annotated image with bounding boxes |
| 6 | `openeye run ... \| jq` | Unix pipeline composability — pipe JSON to jq |
| 7 | `openeye bench yolov8` | Benchmark inference speed (latency, FPS, P95) |
| 8 | `openeye serve yolov8` | Launch a REST API server and query it with curl |
| 9 | Batch loop | Process all 4 demo images and summarize results |

## Demo Images

Four sample images are included in `src/assets/demo/`:

| Image | Scene | Typical detections |
|-------|-------|--------------------|
| `scene-warehouse.jpg` | Warehouse with people and vehicles | person, truck, tv |
| `scene-kitchen.jpg` | Kitchen countertop | apple, cup, donut, bottle |
| `scene-workshop.jpg` | Workshop environment | person, dining table, remote, knife |
| `safety-workspace.jpg` | Safety-critical workspace | (used for safety guardian demos) |

## Output

Annotated images are saved to `demo_output/`. The API server step temporarily runs on port 8111 and shuts down automatically.

## Beyond the Demo

Commands not covered in the scripted demo that you can try interactively:

```bash
# Live webcam detection with terminal overlay
openeye watch --models yolov8

# Safety Guardian — zone-based human proximity alerts
openeye watch --models yolov8 --safety --danger-m 0.5 --caution-m 1.5

# Unitree G1 robot safety demo (dry-run, no robot needed)
openeye g1-demo --control-mode dry_run --demo

# Agentic perception loop — perceive, reason, act
openeye agent run --model yolov8 --goal "monitor workspace"

# Edge device fleet management
openeye fleet ls

# Open-vocabulary detection with text prompts
openeye pull grounding-dino
openeye run grounding-dino photo.jpg --prompt "person. hard hat. forklift."
```

---
title: "One Pipeline, Every Robot: The Case for Hardware-Agnostic Perception"
excerpt: "The robotics industry is fragmented across dozens of hardware platforms, each with its own perception stack. OpenEye's hardware-agnostic architecture means you build your perception once and deploy it everywhere."
date: "2026-02-20"
author: "OpenEye Team"
category: "Architecture"
readTime: "7 min read"
---

The robotics industry has a fragmentation problem. There are dozens of robot platforms, each with its own SDK, its own sensor suite, its own perception pipeline. If you build a perception system for a Unitree robot, you can't use it on a Boston Dynamics platform. If you train safety models for a warehouse AGV, those models don't transfer to a different manufacturer's AGV.

This is wasteful, expensive, and dangerous. Wasteful because teams rebuild the same perception logic for every platform. Expensive because every new platform means new development, testing, and validation. Dangerous because safety systems that work on one platform might behave differently on another due to subtle integration differences.

## The Adapter Pattern

OpenEye solves this with a clean separation between perception and hardware. The perception pipeline — detection, scene understanding, reasoning, planning — is completely hardware-independent. It operates on frames (images) and outputs structured data (scene graphs, action plans, safety signals).

The connection between this universal perception pipeline and specific robot hardware is handled by adapters. An adapter is a thin translation layer that converts OpenEye's structured output into platform-specific commands.

Currently supported adapters:
- **Solo CLI**: For Unitree robots and compatible quadrupeds
- **ROS/ROS2**: For any robot running the Robot Operating System
- **gRPC Generic**: For custom platforms with gRPC endpoints
- **REST**: For web-based robot APIs
- **MQTT**: For IoT-integrated robot systems

Adding a new adapter is typically less than 200 lines of code. The adapter only needs to translate action primitives (move, grasp, halt) into the target platform's API calls.

## What Hardware-Agnostic Actually Means

Hardware-agnostic isn't just about supporting multiple robots. It's about a fundamental design principle: perception logic should never contain hardware assumptions.

In practice, this means:

**Camera independence**: OpenEye works with any camera that produces frames. USB cameras, IP cameras, depth sensors, thermal cameras. The camera layer normalizes everything into a consistent format. Your detection models don't know or care what camera they're running on.

**Compute independence**: The perception pipeline runs on whatever compute is available. A Raspberry Pi for edge detection. A laptop GPU for full-pipeline inference. A cloud GPU for maximum throughput. The same code, different hardware.

**Robot independence**: The action plans OpenEye generates are abstract — "move object_A to location_B" — not platform-specific. The adapter translates these into actual robot commands. Switch robots, keep your perception.

## The Fleet Advantage

Hardware-agnostic perception becomes especially powerful when you're managing a fleet of heterogeneous robots. A modern warehouse might have:

- Mobile AGVs for transport (Platform A)
- Robotic arms for picking (Platform B)
- Inspection drones (Platform C)

Without hardware-agnostic perception, you need three separate perception stacks, three safety systems, three sets of models, three monitoring dashboards.

With OpenEye, you run one perception pipeline with three adapters. The safety system is consistent across all platforms. The scene understanding is shared. One team can manage perception for the entire fleet.

```bash
# Same perception, different robots
openeye watch --reason --adapter solo-cli    # Unitree quadruped
openeye watch --reason --adapter ros2        # ROS2 arm
openeye watch --reason --adapter grpc://drone:50051  # Custom drone
```

## Model Agnostic Too

Hardware-agnosticism extends to the ML models themselves. OpenEye's vision layer is designed to work with any detection model that produces structured output:

- **YOLO variants**: YOLOv8, YOLO-NAS, YOLO26 — swap with a flag
- **Grounding DINO**: For open-vocabulary detection
- **SAM variants**: For segmentation tasks
- **Custom models**: Any ONNX or TorchScript model with the right output format

And for the reasoning layer:
- **Cloud VLMs**: GPT-4o, Claude, Qwen2.5-VL via API
- **Local VLMs**: Any model running through Ollama or vLLM
- **Fine-tuned models**: Your own domain-specific models

```bash
# Swap the detection model
openeye detect --model yolo26 image.jpg
openeye detect --model grounding-dino image.jpg

# Swap the reasoning model
openeye watch --reason --vlm qwen3-vl
openeye watch --reason --vlm local/custom-safety-model
```

## Build Once, Deploy Everywhere

The promise of hardware-agnostic perception is simple: invest in your perception logic once, and deploy it on any robot platform you need today or tomorrow.

When you switch robot vendors — and in this industry, you will — your perception system comes with you. Your safety models, your environment memories, your custom hazard classifiers, your tested and validated pipeline. None of it is locked to the old hardware.

This is what it means to build perception as infrastructure, not as a feature of any single robot. One pipeline. Every robot.

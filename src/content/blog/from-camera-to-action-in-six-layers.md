---
title: "From Camera to Action in Six Layers"
excerpt: "Most robot perception pipelines are tangled messes of ad-hoc integrations. OpenEye's six-layer architecture turns raw pixels into executable actions through a clean, modular pipeline. Here's how each layer works."
date: "2026-03-08"
author: "OpenEye Team"
category: "Architecture"
readTime: "10 min read"
---

Building a perception system for robots is deceptively hard. It's not just running a detection model — it's the entire chain from photons hitting a sensor to a robot arm knowing where to move. Most teams end up with a tangled mess of scripts, model wrappers, and ad-hoc integrations that break every time a component changes.

We designed OpenEye around a six-layer architecture specifically to avoid this. Each layer has a clear input, a clear output, and a well-defined interface. You can swap any layer without touching the others.

## Layer 1: Camera

The camera layer handles hardware abstraction. USB cameras, IP cameras, depth sensors, stereo rigs — they all produce different formats, at different framerates, with different quirks. The camera layer normalizes all of this into a consistent frame stream.

This sounds trivial. It isn't. Camera drivers are the number one source of production failures in deployed perception systems. The camera layer handles reconnection, framerate negotiation, format conversion, and buffering so that nothing downstream ever has to think about hardware.

**Input**: Raw sensor data
**Output**: Normalized frame stream (RGB, configurable resolution and framerate)

## Layer 2: Vision

The vision layer runs detection and segmentation models. Currently, this means YOLO for fast object detection and SAM for segmentation when needed. But the layer is model-agnostic — you can plug in any detection model that produces bounding boxes and class labels.

The key design decision here is that the vision layer only produces low-level detections. It doesn't try to understand the scene. It doesn't reason about relationships. It just tells you what objects are where, with what confidence.

**Input**: Normalized frames
**Output**: Structured detections (bounding boxes, class labels, confidence scores, segmentation masks)

## Layer 3: Scene

The scene layer is where raw detections become understanding. It takes the flat list of detections from the vision layer and constructs a scene graph — a structured representation of objects and their spatial relationships.

This is where you go from "there's a cup at (340, 280) and a table at (0, 400)" to "the cup is on the table, 30cm from the edge, near the keyboard." The scene layer computes spatial relationships, proximity zones, and hazard classifications.

The scene graph is the central data structure in OpenEye. Everything downstream — safety, planning, memory — operates on the scene graph, not on raw detections.

**Input**: Structured detections
**Output**: Scene graph with spatial relationships, proximity zones, and hazard flags

## Layer 4: LLM

The LLM layer adds reasoning to the perception pipeline. It takes the scene graph and runs it through a Vision Language Model to produce natural language scene descriptions, risk assessments, and contextual understanding.

This is where the system goes from "knife is 2cm from hand_path" to "the knife is dangerously close to the operator's hand trajectory. Recommend pausing and relocating the knife to the safe zone before continuing."

The LLM layer is optional — many real-time applications skip it for latency reasons. But for safety monitoring, action planning, and human-readable reporting, it's essential.

**Input**: Scene graph + current frame
**Output**: Natural language analysis, risk scores, recommendations

## Layer 5: Planning

The planning layer takes a natural language goal and the current scene state, and produces a structured action plan. "Clear the workspace" becomes a sequence of specific, executable steps: move object A to location B, then object C to location D.

The planner considers:
- Current object positions from the scene graph
- Hazard zones and safety constraints
- Physical affordances (can this object be grasped? Is the target location reachable?)
- Efficiency (minimize total robot motion)

**Input**: Natural language goal + scene graph
**Output**: Ordered action plan with specific object-location pairs

## Layer 6: Execution

The execution layer translates the action plan into robot-specific commands and streams them to the downstream system. This is where OpenEye meets the physical world.

The execution layer uses adapters to support different robot platforms. A Unitree G1 connector for Unitree robots with SDK, HTTP, and dry-run modes. A ROS adapter for ROS-based systems. A generic WebSocket adapter for custom platforms. The adapter pattern means adding support for a new robot is a single module, not a rewrite.

**Input**: Structured action plan
**Output**: Robot-specific commands via WebSocket, REST, or platform-specific protocol

## Why Six Layers?

The temptation in any perception system is to blur the boundaries. Run detection and scene understanding in one model. Combine planning and execution. It feels more efficient.

It isn't. Clean layer boundaries give you:

- **Debuggability**: When something goes wrong, you can inspect the output of each layer and find exactly where the failure occurred.
- **Modularity**: Swap YOLO for a different detector? Change one layer. Switch from OpenAI to a local LLM? Change one layer. New robot platform? Add one adapter.
- **Testing**: Each layer can be unit tested in isolation with synthetic inputs.
- **Performance**: Layers can run at different framerates. Detection at 30fps, LLM reasoning at 2fps, planning on-demand.

Six layers. One pipeline. Every robot.

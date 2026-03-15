---
title: WebSocket
---

The self-hosted server exposes four WebSocket endpoints for real-time inference at different levels of the perception stack.

### ws://host:port/ws

Basic real-time inference. Send base64-encoded image frames, receive JSON detection results (same schema as `POST /predict`).

- Send: Base64-encoded image as text frame
- Receive: JSON prediction result
- Error: `{"error": "description"}` if inference fails

### ws://host:port/ws/perception

Perception pipeline with scene graph. Runs YOLO detection through the full `PerceptionPipeline`, producing scene graphs, spatial relationships, safety zones, and change alerts. Falls back to basic detection if the pipeline module is unavailable.

- Send: Base64-encoded image as text frame
- Receive: `PerceptionFrame` JSON with `objects`, `scene_graph`, `scene_description`, `safety_alerts`, `safety_zones`, `change_alerts`

### ws://host:port/ws/vlm

VLM reasoning endpoint. Sends frames to a vision-language model (Nebius Token Factory or OpenRouter) for high-level scene analysis and safety reasoning.

- Send: Base64-encoded image as text frame
- Receive: `{"description": "...", "reasoning": "...", "latency_ms": 500.0}`
- Requires `NEBIUS_API_KEY` or `OPENROUTER_API_KEY` environment variable

### ws://host:port/ws/agentic

Continuous agentic loop combining detection, scene graph, VLM reasoning, and action planning. Maintains persistent memory across frames (object tracking, timeline events, goal state).

- Send: JSON with `frame` (base64, required), `goal` (optional), `set_goal` (optional)
- Also accepts raw base64 for backward compatibility
- Receive: `agentic_frame` JSON with detections, scene graph, VLM reasoning, action plan, memory state, and latency breakdown
- VLM reasoning is throttled to every 3 seconds
- Supports `ping`/`pong` keepalive

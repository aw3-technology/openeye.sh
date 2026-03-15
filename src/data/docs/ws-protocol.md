---
title: Streaming Protocol
---

### Self-Hosted WebSocket — /ws

Basic real-time inference endpoint.

- 1. Connect to `ws://localhost:8000/ws`
- 2. Send base64-encoded image frames as text messages
- 3. Receive JSON detection results for each frame

Send each frame as a base64-encoded string (no data URI prefix). The server responds with the same JSON schema as `POST /predict`.

### Perception Pipeline — /ws/perception

Scene-aware perception with object tracking and spatial reasoning.

- 1. Connect to `ws://localhost:8000/ws/perception`
- 2. Send base64-encoded image frames as text messages
- 3. Receive PerceptionFrame JSON with scene graph, safety zones, and change detection

The response includes `objects` (detected objects with normalized bboxes), `scene_graph` (nodes and relationships), `scene_description`, `safety_alerts`, `safety_zones`, and `change_alerts`.

### VLM Reasoning — /ws/vlm

Vision-language model reasoning for high-level scene analysis.

- 1. Connect to `ws://localhost:8000/ws/vlm`
- 2. Send base64-encoded image frames as text messages
- 3. Receive `{"description": "...", "reasoning": "...", "latency_ms": ...}`

Requires `NEBIUS_API_KEY` (for Nebius Token Factory) or `OPENROUTER_API_KEY` (for OpenRouter). The VLM model is configured via the `NEBIUS_MODEL` environment variable or runtime config.

### Agentic Loop — /ws/agentic

Continuous perception-reasoning-planning loop with persistent memory.

- 1. Connect to `ws://localhost:8000/ws/agentic`
- 2. Send JSON messages: `{"frame": "<base64>", "goal": "...", "set_goal": "..."}`
- 3. Receive `agentic_frame` JSON with full perception + reasoning output

The agentic endpoint maintains state across frames: object tracking (appearance/disappearance), timeline events, and goal context. VLM reasoning is called at most every 3 seconds to manage latency.

Response fields: `detections`, `scene_graph`, `scene_description`, `vlm_reasoning`, `action_plan`, `safety_zones`, `safety_alerts`, `change_alerts`, `memory` (objects tracked, timeline, frame count), `latency` (detection_ms, vlm_ms, total_ms), `goal`, `frame_id`.

### Hosted API Streaming — /v1/stream

The hosted API includes a WebSocket streaming endpoint at `wss://api.openeye.ai/v1/stream` with API key authentication and credit-based billing.

- 1. Connect to `wss://api.openeye.ai/v1/stream`
- 2. Send auth: `{"api_key": "oe_xxx"}`
- 3. Server responds: `{"status": "authenticated"}`
- 4. Optionally send config: `{"model": "yolov8", "confidence": 0.3}`
- 5. Send base64-encoded image frames as text messages
- 6. Receive detection JSON for each frame

Cost: 1 credit per frame. Rate limits apply per API key.

---
title: "Real-Time Perception Streaming with WebSockets"
excerpt: "Robot perception data is only valuable if it reaches downstream systems in real-time. Here's how OpenEye uses WebSocket streaming to deliver structured perception data with sub-50ms latency to any system that needs it."
date: "2026-02-15"
author: "OpenEye Team"
category: "Technical Deep Dive"
readTime: "8 min read"
---

Perception data that arrives late is perception data that's useless. If your safety system detects a hazard 200ms after it occurs, the robot has already moved. If your planning system receives stale scene data, it makes decisions based on a world that no longer exists.

Real-time perception streaming isn't a nice-to-have feature — it's a fundamental requirement. And it's harder to get right than most people think.

## Why WebSockets?

We evaluated several protocols for perception streaming before settling on WebSockets:

**REST/HTTP**: Too much overhead per message. Each request requires connection setup, headers, and response handling. For streaming 30 detections per second, the HTTP overhead alone exceeds the useful payload size.

**MQTT**: Great for IoT and low-bandwidth scenarios but not designed for the throughput and latency requirements of real-time perception. Message ordering guarantees are also weaker than needed.

**Server-Sent Events (SSE)**: Unidirectional only. Good for simple push scenarios, but perception streaming needs bidirectional communication — clients need to send configuration updates, subscribe to specific data channels, and control stream parameters without opening separate connections.

**WebSockets**: Full-duplex communication over a single TCP connection. Native browser support for dashboard and monitoring UIs. JSON payloads for universal compatibility. Built on top of FastAPI's async infrastructure for high throughput. Works seamlessly with Python's async ecosystem and pairs naturally with the rest of OpenEye's FastAPI server. This is what we use.

## The Perception Endpoints

OpenEye's FastAPI server exposes four WebSocket endpoints, each delivering a different level of perception data:

**`/ws`** — Raw detection stream. Object detections at camera framerate. The fastest, lightest stream for systems that only need bounding boxes and class labels.

**`/ws/perception`** — Full perception pipeline. Detections enriched with scene graph construction, spatial relationships, and hazard flags. The standard stream for most production integrations.

**`/ws/vlm`** — VLM reasoning stream. Includes everything from the perception stream plus the Vision Language Model's contextual analysis — natural language scene descriptions, risk assessments, and recommendations.

**`/ws/agentic`** — Agentic loop stream. The full perception-reasoning-planning cycle. Delivers continuous action plans alongside perception data for autonomous operation.

Each endpoint delivers structured JSON messages. A `/ws/perception` frame looks like this (abbreviated):

```json
{
  "frame_id": 1042,
  "timestamp": 1710523847.0,
  "inference_ms": 18.4,
  "objects": [
    {"track_id": "cup_01", "label": "cup", "confidence": 0.94, "bbox": {"x": 0.34, "y": 0.28, "w": 0.12, "h": 0.15}}
  ],
  "scene_graph": {"nodes": [...], "relationships": [...]},
  "scene_description": "Coffee cup stable on desk surface. No immediate risks detected.",
  "safety_alerts": []
}
```

Each frame includes everything a downstream system might need:
- **Detections**: Raw object detections with bounding boxes, classes, and confidence scores
- **Scene graph**: Spatial relationships, zones, and object properties
- **Hazards**: Active hazard flags with severity levels
- **Analysis**: When available, the VLM's contextual analysis

The server starts with a single command:

```bash
openeye serve yolov8 --port 8000
```

Any WebSocket client can connect to the appropriate endpoint and start receiving perception frames immediately.

## Latency Architecture

The total latency from photon to WebSocket message has four components:

1. **Camera capture**: 10-33ms (depends on framerate)
2. **Detection inference**: 15-30ms (YOLO on GPU)
3. **Scene graph construction**: 1-3ms
4. **WebSocket serialization + transport**: 1-5ms (local network)

Total: **27-71ms** from the physical event to the downstream consumer receiving structured data about it.

For safety-critical paths, we optimize further. The hazard detection runs on a fast path that bypasses the full scene graph construction, getting safety signals to consumers in under 40ms.

## Backpressure and Flow Control

The biggest challenge in perception streaming isn't speed — it's handling consumers that can't keep up. If a downstream system processes frames slower than they arrive, you need a strategy.

OpenEye bounds the work instead of letting it pile up. Every request goes through an inference queue that runs one inference at a time and holds at most 16 waiting frames. When the queue is full, the server answers that frame with a "Server busy" error right away rather than queueing it, so a client that falls behind gets fresh results once it catches up instead of a growing backlog of stale ones — stale data is worse than no data.

You can watch the queue from the CLI or over HTTP:

```bash
openeye health --server http://localhost:8000
curl http://localhost:8000/queue/status
```

## Multi-Consumer Architecture

A single OpenEye instance can stream to multiple consumers simultaneously. This is essential in production deployments where different systems need the same perception data:

- **Safety controller**: Connects to `/ws` for hazard data at full framerate
- **Planning system**: Connects to `/ws/perception` for scene graphs at reduced rate
- **VLM dashboard**: Connects to `/ws/vlm` for reasoning visualization
- **Agentic system**: Connects to `/ws/agentic` for the full perception-to-action loop
- **Logging system**: Connects to `/ws/perception` and writes everything for compliance

Each consumer connects to the endpoint that matches its needs and receives data independently. The perception engine runs once; the data flows to everyone who needs it.

## REST Endpoints Too

Not every integration needs a persistent stream. For simpler use cases, OpenEye also exposes a REST endpoint for single-frame inference:

```bash
# Single-frame detection
curl -X POST http://localhost:8000/predict -F "file=@image.jpg"
```

The REST API produces JSON — the same structured format as the WebSocket streams. Useful for batch processing, one-off detections, and systems that don't need continuous perception.

## Structured Data, Not Video

A key architectural decision: OpenEye streams structured perception data, not video. We don't send compressed video frames over WebSockets (though you can access the raw camera feed separately if needed). We send the processed, structured understanding of what's in those frames.

This is more useful and more efficient. A video frame is 1-10MB of pixels. A perception frame is 1-10KB of structured data describing what those pixels contain. You can stream structured perception over a cellular connection. You can log it efficiently. You can query it with standard data tools.

Perception streaming is the bridge between computer vision and robotic action. OpenEye's WebSocket implementation makes that bridge fast, reliable, and production-ready.

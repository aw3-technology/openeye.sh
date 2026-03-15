---
title: "Real-Time Perception Streaming with gRPC"
excerpt: "Robot perception data is only valuable if it reaches downstream systems in real-time. Here's how OpenEye uses gRPC streaming to deliver structured perception data with sub-50ms latency to any system that needs it."
date: "2026-02-15"
author: "OpenEye Team"
category: "Technical Deep Dive"
readTime: "8 min read"
---

Perception data that arrives late is perception data that's useless. If your safety system detects a hazard 200ms after it occurs, the robot has already moved. If your planning system receives stale scene data, it makes decisions based on a world that no longer exists.

Real-time perception streaming isn't a nice-to-have feature — it's a fundamental requirement. And it's harder to get right than most people think.

## Why gRPC?

We evaluated several protocols for perception streaming before settling on gRPC:

**REST/HTTP**: Too much overhead per message. Each request requires connection setup, headers, and response handling. For streaming 30 detections per second, the HTTP overhead alone exceeds the useful payload size.

**WebSockets**: Good for browser-based consumers but lacks the structured contracts (Protocol Buffers) and built-in features (backpressure, flow control, deadlines) that production systems need.

**MQTT**: Great for IoT and low-bandwidth scenarios but not designed for the throughput and latency requirements of real-time perception. Message ordering guarantees are also weaker than needed.

**gRPC**: Server-side and bidirectional streaming. Protocol Buffers for typed, efficient serialization. Built-in flow control. Deadline propagation. Client-side load balancing. Broad language support (Python, C++, Go, Rust, Java). This is what production systems use.

## The Perception Stream

OpenEye's gRPC stream delivers structured perception data as a continuous flow of messages:

```protobuf
message PerceptionFrame {
  int64 timestamp_ms = 1;
  int32 frame_number = 2;
  repeated Detection detections = 3;
  SceneGraph scene_graph = 4;
  repeated Hazard hazards = 5;
  optional Analysis analysis = 6;
}
```

Each frame includes everything a downstream system might need:
- **Detections**: Raw object detections with bounding boxes, classes, and confidence scores
- **Scene graph**: Spatial relationships, zones, and object properties
- **Hazards**: Active hazard flags with severity levels
- **Analysis**: When available, the VLM's contextual analysis

The stream starts with a single command:

```bash
openeye stream --grpc --port 50051
```

Any gRPC client can connect and start receiving perception frames immediately.

## Latency Architecture

The total latency from photon to gRPC message has four components:

1. **Camera capture**: 10-33ms (depends on framerate)
2. **Detection inference**: 15-30ms (YOLO on GPU)
3. **Scene graph construction**: 1-3ms
4. **gRPC serialization + transport**: 1-5ms (local network)

Total: **27-71ms** from the physical event to the downstream consumer receiving structured data about it.

For safety-critical paths, we optimize further. The hazard detection runs on a fast path that bypasses the full scene graph construction, getting safety signals to consumers in under 40ms.

## Backpressure and Flow Control

The biggest challenge in perception streaming isn't speed — it's handling consumers that can't keep up. If a downstream system processes frames slower than they arrive, you need a strategy.

OpenEye implements three backpressure modes:

**Drop oldest**: When the consumer falls behind, drop older frames and send the latest. This is the default for most real-time applications — stale data is worse than no data.

**Buffer**: Maintain a configurable buffer of frames. Useful for consumers that process in bursts (batch planners, logging systems).

**Block**: Slow down the entire pipeline to match the slowest consumer. Used when every frame matters (forensic recording, compliance logging).

```bash
# Default: drop oldest frames when consumer is slow
openeye stream --grpc --backpressure drop

# Buffer up to 100 frames
openeye stream --grpc --backpressure buffer --buffer-size 100

# Block if consumer can't keep up
openeye stream --grpc --backpressure block
```

## Multi-Consumer Architecture

A single OpenEye instance can stream to multiple consumers simultaneously. This is essential in production deployments where different systems need the same perception data:

- **Safety controller**: Needs hazard data at full framerate
- **Planning system**: Needs scene graphs at reduced rate (2-5 fps)
- **Logging system**: Needs everything for compliance
- **Dashboard**: Needs visualization data at display refresh rate
- **Analytics**: Needs aggregated statistics periodically

Each consumer connects independently and receives data according to its subscription parameters. The perception engine runs once; the data flows to everyone who needs it.

## REST Fallback

Not every system speaks gRPC. For simpler integrations, OpenEye also exposes a REST API with server-sent events (SSE) for streaming:

```bash
openeye stream --rest --port 8080

# Consumer
curl -N http://localhost:8080/stream/detections
```

The REST API produces JSON instead of Protocol Buffers — larger payload, but universally consumable. Useful for web dashboards, quick integrations, and systems that already speak HTTP.

## Structured Data, Not Video

A key architectural decision: OpenEye streams structured perception data, not video. We don't send compressed video frames over gRPC (though you can access the raw camera feed separately if needed). We send the processed, structured understanding of what's in those frames.

This is more useful and more efficient. A video frame is 1-10MB of pixels. A perception frame is 1-10KB of structured data describing what those pixels contain. You can stream structured perception over a cellular connection. You can log it efficiently. You can query it with standard data tools.

Perception streaming is the bridge between computer vision and robotic action. OpenEye's gRPC implementation makes that bridge fast, reliable, and production-ready.

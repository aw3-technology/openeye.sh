---
title: Schema Reference
---

OpenEye uses Pydantic models for structured output. All models are defined in `cli/openeye_ai/schema.py`.

### BBox

Normalized bounding box (0-1 range).

| Field | Type | Description |
|-------|------|-------------|
| x | float | Left edge (0-1) |
| y | float | Top edge (0-1) |
| w | float | Width (0-1) |
| h | float | Height (0-1) |

### DetectedObject

| Field | Type | Description |
|-------|------|-------------|
| label | str | Class label |
| confidence | float | Detection confidence (0-1) |
| bbox | BBox | Bounding box |

### ImageInfo

| Field | Type | Description |
|-------|------|-------------|
| width | int | Image width in pixels |
| height | int | Image height in pixels |
| source | str | Source identifier |

### SegmentationMask

| Field | Type | Description |
|-------|------|-------------|
| mask | str | Base64-encoded mask PNG |
| area | int | Mask area in pixels |
| bbox | BBox | Bounding box of mask |
| stability_score | float | Mask stability score |

### PredictionResult

| Field | Type | Description |
|-------|------|-------------|
| model | str | Model name |
| task | str | Task type (detection, depth, segmentation) |
| timestamp | str | ISO 8601 timestamp |
| image | ImageInfo | Input image info |
| objects | list[DetectedObject] | Detected objects |
| depth_map | str or null | Base64 depth map PNG |
| segmentation_masks | list[SegmentationMask] or null | Segmentation masks from SAM2 |
| vla_action | list[float] or null | VLA action vector for robotic control |
| inference_ms | float | Inference time in milliseconds |

### Observation

A memory-worthy snapshot from one perception tick, used by the agentic pipeline.

| Field | Type | Description |
|-------|------|-------------|
| id | str | Auto-generated unique ID |
| tick | int | Tick number |
| timestamp | str | ISO 8601 timestamp |
| detections | list[DetectedObject] | Objects detected in this tick |
| scene_summary | str | Brief scene summary |
| change_description | str | What changed since last tick |
| significance | float | Significance score (0-1) |
| tags | list[str] | Searchable tags |

### AgentReasoning

One reasoning step produced by the LLM in the agentic loop.

| Field | Type | Description |
|-------|------|-------------|
| observation_summary | str | Summary of what was observed |
| memory_context | str | Relevant context recalled from memory |
| chain_of_thought | str | LLM reasoning chain |
| current_plan | list[str] | Current action plan steps |
| decided_action | str | Action decided by the agent |
| plan_changed | bool | Whether the plan was updated this tick |

### AgentTickEvent

Complete tick output streamed to clients via SSE from `/agent/stream`.

| Field | Type | Description |
|-------|------|-------------|
| tick | int | Tick number |
| phase | str | Current phase: perceive, recall, reason, or act |
| prediction | PredictionResult or null | Raw prediction result |
| observation | Observation or null | Processed observation |
| reasoning | AgentReasoning or null | LLM reasoning output |
| action_taken | str | Action that was executed |
| memory_recalled | list[Observation] | Observations recalled from memory |
| current_plan | list[str] | Current plan steps |
| timestamp | str | ISO 8601 timestamp |

### RecallQuery

Query for memory recall via `POST /agent/recall`.

| Field | Type | Description |
|-------|------|-------------|
| query | str | Free-text query |
| time_range | str or null | Time filter (e.g. "last_1h", "last_24h") |
| significance_min | float | Minimum significance threshold |
| limit | int | Max results to return (default 10) |

### RecallResult

Response from memory recall.

| Field | Type | Description |
|-------|------|-------------|
| observations | list[Observation] | Matching observations |
| query | str | The query that was executed |
| total_matches | int | Total number of matches |

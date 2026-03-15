# Perception Pipeline Reference

## Pipeline Stages

Frames flow through these stages in order:

```
Camera Frame
  -> Detection (YOLO / Grounding DINO)
  -> Depth Estimation (Depth Anything V2)
  -> Object Tracking (IoU-based, consistent IDs)
  -> 3D Position Estimation (2D + depth -> 3D coordinates)
  -> Scene Graph (spatial relationships between objects)
  -> Safety Guardian (zone awareness, halt protocol)
  -> Change Detection (appear/disappear/move alerts)
  -> Natural Language Query (ask questions about the scene)
```

## Output: PerceptionFrame

Each processed frame produces a `PerceptionFrame` containing:

- `objects`: List of `DetectedObject3D` with bbox, label, confidence, track_id, 3D position
- `depth_map`: Per-pixel depth values
- `spatial_relationships`: List of relations (e.g., "mug ON table", "person NEAR shelf")
- `safety_zones`: Regions classified as safe/caution/danger
- `change_alerts`: Objects that appeared, disappeared, or moved significantly
- `action_suggestions`: Recommended actions given current scene and goal

## Safety Guardian

Sub-100ms human detection with emergency halt capability.

- **Safe zone**: Normal operation
- **Caution zone**: Reduced speed, increased awareness
- **Danger zone**: Immediate halt, alert operator

Configure zone distances per device via fleet config:
```bash
openeye fleet config <device-id> '{"danger_zone_m": 0.5, "caution_zone_m": 1.5}'
```

## Scene Graph Spatial Relations

Supported relations: `ON`, `UNDER`, `NEAR`, `LEFT_OF`, `RIGHT_OF`, `ABOVE`, `BELOW`, `BEHIND`, `IN_FRONT_OF`, `INSIDE`, `CONTAINS`.

## Natural Language Queries

Query the current scene state:
- "What objects are on the table?"
- "Is anyone in the danger zone?"
- "How far is the nearest person?"
- "What changed since the last frame?"

## Regions of Interest

Focus perception on specific areas to reduce compute:
```json
{"roi": {"x": 100, "y": 100, "width": 400, "height": 300, "label": "workbench"}}
```

## Backend Runtime Modes

The perception engine supports mode-based operation:
- Single-mode: One continuous perception configuration
- Multi-mode: Switch between configurations based on triggers (input, time, context)

Configuration in JSON5 format at `backend/config/`.

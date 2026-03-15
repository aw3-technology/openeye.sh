# Schema Reference

OpenEye uses Pydantic models for structured output. All models are defined in `cli/openeye_ai/schema.py`.

## BBox

Normalized bounding box (0-1 range).

| Field | Type | Description |
|-------|------|-------------|
| `x` | float | Left edge (0-1) |
| `y` | float | Top edge (0-1) |
| `w` | float | Width (0-1) |
| `h` | float | Height (0-1) |

## DetectedObject

A single detected object.

| Field | Type | Description |
|-------|------|-------------|
| `label` | str | Class label |
| `confidence` | float | Detection confidence (0-1) |
| `bbox` | BBox | Bounding box |

## ImageInfo

Metadata about the input image.

| Field | Type | Description |
|-------|------|-------------|
| `width` | int | Image width in pixels |
| `height` | int | Image height in pixels |
| `source` | str | Source identifier |

## PredictionResult

Complete inference result.

| Field | Type | Description |
|-------|------|-------------|
| `model` | str | Model name |
| `task` | str | Task type (detection, depth) |
| `timestamp` | str | ISO 8601 timestamp |
| `image` | ImageInfo | Input image info |
| `objects` | list[DetectedObject] | Detected objects (empty for depth) |
| `depth_map` | str \| null | Base64 depth map PNG |
| `inference_ms` | float | Inference time in milliseconds |

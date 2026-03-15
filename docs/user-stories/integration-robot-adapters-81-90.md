# Integration & Robot Adapters (81–90)

---

## 81. ROS2 Topic Publisher

**As a ROS developer, I can publish OpenEye detections as ROS2 topics.**

### Acceptance Criteria

- [ ] A ROS2 adapter exists at `cli/openeye_ai/adapters/ros2.py` implementing `ModelAdapter`-compatible output publishing
- [ ] Running `openeye watch --adapter ros2` publishes detections to `/openeye/detections` as a `vision_msgs/Detection2DArray` message
- [ ] Scene descriptions publish to `/openeye/scene` as `std_msgs/String` (JSON-serialized `PredictionResult`)
- [ ] Depth maps publish to `/openeye/depth` as `sensor_msgs/Image`
- [ ] Topic names are configurable via `--topic-prefix` (default: `/openeye`)
- [ ] QoS profiles default to `RELIABLE` for detections and `BEST_EFFORT` for raw frames, both configurable
- [ ] Frame ID (`--frame-id`, default `camera_link`) is included in all message headers
- [ ] Publisher works with ROS2 Humble and Jazzy distributions
- [ ] Detections include `header.stamp` synchronized with the source camera frame timestamp
- [ ] `ros2` is an optional dependency: `pip install openeye-sh[ros2]` installs `rclpy` and `vision_msgs`
- [ ] Graceful error if `rclpy` is not installed — prints install instructions and exits

### Edge Cases

- [ ] Publishes an empty `Detection2DArray` (not skipped) when no objects are detected in a frame, so subscribers can distinguish "no detections" from "no data"
- [ ] If the ROS2 daemon (`ros2 daemon`) is not running, the node starts standalone and logs a warning
- [ ] Handles topic name collisions gracefully — if another node is already publishing on the same topic, logs a warning with the conflicting node name
- [ ] When multiple models are loaded (`--models yolov8,grounding-dino`), each model publishes to a namespaced topic (e.g., `/openeye/yolov8/detections`, `/openeye/grounding_dino/detections`)
- [ ] Respects ROS2 `use_sim_time` parameter — uses simulation clock when available instead of wall clock
- [ ] Large depth maps that exceed the default DDS message size (64KB) are handled by setting appropriate QoS fragment size or warning the user to configure `RMW_CONNEXT_LARGE_DATA`
- [ ] Node handles `SIGINT` and `SIGTERM` for clean shutdown (no zombie nodes in `ros2 node list`)
- [ ] If the model inference hangs or crashes, the ROS2 node remains alive and publishes a diagnostic error to `/diagnostics`

### Technical Notes

- Depends on `rclpy`, `vision_msgs`, `sensor_msgs`, `std_msgs`
- Each `DetectedObject` from `schema.py` maps to a `Detection2D` with `BoundingBox2D` (denormalized to pixel coords using `ImageInfo.width/height`)
- Node name defaults to `openeye_perception`

---

## 82. ROS2 Camera Subscriber

**As a ROS developer, I can subscribe to camera topics and feed them into OpenEye.**

### Acceptance Criteria

- [ ] `openeye watch --input ros2 --camera-topic /camera/image_raw` subscribes to a ROS2 image topic and runs inference
- [ ] Supports `sensor_msgs/Image` (raw) and `sensor_msgs/CompressedImage` topics
- [ ] Automatically detects encoding (`rgb8`, `bgr8`, `mono8`) and converts to PIL RGB for the adapter pipeline
- [ ] Supports `image_transport` compressed topics (`/camera/image_raw/compressed`)
- [ ] Camera intrinsics from `/camera/camera_info` are optionally consumed and included in output metadata
- [ ] Inference results are published back as ROS2 topics (per story 81) when `--publish` flag is set
- [ ] Configurable inference throttle via `--max-fps` to avoid overloading the model on high-rate camera topics (default: 10 Hz)
- [ ] Works with standard ROS2 camera drivers (usb_cam, v4l2_camera, realsense2_camera)
- [ ] `Ctrl+C` cleanly shuts down the ROS2 node and releases resources
- [ ] Can run alongside other ROS2 nodes in the same process via `launch` file integration

### Edge Cases

- [ ] If the subscribed camera topic does not exist or stops publishing, logs a warning after a configurable timeout (`--topic-timeout`, default: 5s) and retries — does not crash
- [ ] If frames arrive faster than inference can process, a bounded queue (default depth: 5) drops the oldest unprocessed frames and increments a `frames_dropped` counter exposed via `/openeye/diagnostics`
- [ ] Handles uncommon image encodings (`bayer_rggb8`, `16UC1` depth, `yuv422`) — unsupported encodings log a clear error listing supported formats and skip the frame
- [ ] If image dimensions change mid-stream (e.g., dynamic resolution switching), the adapter re-initializes internal buffers without crashing
- [ ] Handles `sensor_msgs/CompressedImage` with JPEG, PNG, and TIFF compression — unsupported compression types (theora, h264) log a warning and suggest using raw topics instead
- [ ] If `camera_info` has zero focal length or invalid distortion coefficients, it is ignored with a warning rather than causing a crash
- [ ] Multi-camera: `--camera-topic` accepts comma-separated topics (`/cam0/image_raw,/cam1/image_raw`), each processed independently with results tagged by source topic
- [ ] If `cv_bridge` is not installed, falls back to raw numpy conversion with a warning about potential encoding issues

### Technical Notes

- Uses `cv_bridge` or raw numpy conversion to go from ROS2 `Image` to `PIL.Image`
- If `--input ros2` is specified without `--camera-topic`, defaults to `/camera/image_raw`
- The existing `Camera` class in `utils/camera.py` should be extended with a `ROS2CameraSource` that implements the same interface

---

## 83. OpenClaw Perception Module

**As an OpenClaw user, I can connect OpenEye as the perception module for manipulation tasks.**

### Acceptance Criteria

- [ ] An OpenClaw adapter exists at `cli/openeye_ai/adapters/openclaw.py`
- [ ] `openeye watch --adapter openclaw --endpoint localhost:50052` streams detections to an OpenClaw controller
- [ ] Detections include 6-DOF grasp pose estimates when a depth model is co-loaded (`--models yolov8,depth-anything`)
- [ ] Object detections include workspace-relative coordinates (transformed from camera frame using an optional `--extrinsics` calibration file)
- [ ] Safety system integration: when a `hazard` classification is detected, sends an immediate `HALT` command to OpenClaw
- [ ] Resume command is sent only after hazard clears for a configurable `--clear-duration` (default: 2 seconds)
- [ ] Supports OpenClaw's object query API: OpenClaw can request "where is the red cup?" and OpenEye responds with the latest detection matching that description
- [ ] Object tracking IDs are persistent across frames so OpenClaw can track objects during manipulation
- [ ] Connection loss to OpenClaw triggers a warning log and automatic reconnection with exponential backoff
- [ ] Works with OpenClaw simulation mode for testing without physical hardware

### Edge Cases

- [ ] If HALT is issued while the robot arm is mid-manipulation (holding an object), the halt message includes the arm's last known state so OpenClaw can decide whether to drop or freeze
- [ ] Multiple simultaneous hazards are coalesced into a single HALT with all hazard reasons listed — does not send redundant HALT commands
- [ ] If the depth model fails while detection succeeds (partial pipeline failure), detections are still forwarded without depth data, and a `depth_unavailable` flag is set
- [ ] If `--extrinsics` calibration file is missing or malformed, falls back to camera-frame coordinates with a warning — does not block perception
- [ ] Object tracking handles occlusion: if an object disappears behind another and reappears within `--reacquire-window` (default: 3s), it retains its original tracking ID
- [ ] Object queries returning multiple matches (e.g., two red cups) return all matches ranked by confidence, not just the top one
- [ ] gRPC message size limit: if a single frame's detection payload exceeds 4MB (gRPC default max), automatically chunks or compresses depth data
- [ ] If OpenClaw reboots or updates firmware, the adapter detects the version change on reconnect and re-negotiates capabilities
- [ ] Exponential backoff for reconnection caps at 30 seconds and logs each retry attempt
- [ ] If OpenClaw is in simulation mode but the extrinsics file references a physical setup, logs a warning about coordinate mismatch

### Technical Notes

- Communication uses gRPC (OpenClaw's native protocol)
- Object queries use the grounding-dino adapter for open-vocabulary matching
- Grasp pose estimation may use depth + detection fusion — outputs `[x, y, z, roll, pitch, yaw]`

---

## 84. Solo CLI Adapter

**As a Solo CLI user, I can pipe OpenEye perception into Solo for end-to-end autonomous operation.**

### Acceptance Criteria

- [ ] `openeye watch --adapter solo-cli` pipes structured perception JSON to Solo CLI's stdin
- [ ] Output format matches Solo CLI's expected perception input schema (one JSON object per line, newline-delimited)
- [ ] Each perception frame includes: `timestamp`, `objects[]`, `scene_description`, `hazards[]`, `confidence`
- [ ] `openeye watch --reason --adapter solo-cli` includes VLM reasoning in the output for Solo's planning layer
- [ ] Works via Unix pipe: `openeye watch --reason | solo act --perception stdin`
- [ ] Works via TCP socket: `openeye stream --adapter solo-cli --port 9000` for networked setups (e.g., perception on workstation, Solo on robot)
- [ ] Halt signals are sent as `{"type": "halt", "reason": "..."}` messages that Solo CLI interprets immediately
- [ ] Adapter handles Solo CLI backpressure — drops oldest frames if Solo is processing slowly
- [ ] Latency from camera capture to Solo receiving the perception frame is under 200ms on local pipe
- [ ] Solo CLI version compatibility is checked on startup; warns if version mismatch detected

### Edge Cases

- [ ] If Solo CLI terminates or the pipe breaks, OpenEye catches `SIGPIPE` / `BrokenPipeError` and exits cleanly with a descriptive error — does not crash with a traceback
- [ ] JSON output is sanitized: special characters (e.g., newlines in scene descriptions) are escaped so they don't break NDJSON line parsing
- [ ] If the TCP socket port is already in use, fails with a clear error message suggesting an alternative port
- [ ] TCP socket mode supports exactly one Solo client at a time — additional connections are rejected with a message, not silently dropped
- [ ] If Solo CLI is slow to consume and the backpressure buffer fills (default: 100 frames), dropped frame count is included in the next successfully sent frame's metadata
- [ ] Handles Solo CLI restart: if the pipe/socket reconnects, OpenEye resumes streaming from the current frame without requiring an OpenEye restart
- [ ] Timestamps use ISO 8601 with UTC timezone in all output — no ambiguity from local timezone
- [ ] If `--reason` is set but no VLM model is loaded, exits with a clear error: "VLM model required for --reason. Add a VLM to --models"
- [ ] Partial JSON writes (frame larger than pipe buffer) are handled atomically — each frame is written as a complete line or not at all

### Technical Notes

- Solo CLI expects NDJSON (newline-delimited JSON) on stdin
- The `--adapter solo-cli` flag configures the output formatter, not the model — any model combination works
- References the existing terminal output in `watch` command at `cli.py:273-302`

---

## 85. Python SDK Client

**As a developer, I can use the Python SDK (`from openeye import Client`) to connect to a running server programmatically.**

### Acceptance Criteria

- [ ] `from openeye_ai import Client` provides a high-level Python client
- [ ] `Client(host="localhost", port=8000)` connects to a running `openeye serve` instance
- [ ] `client.predict(image_path)` sends an image and returns a `PredictionResult` Pydantic model
- [ ] `client.predict(pil_image)` accepts a `PIL.Image` directly
- [ ] `client.predict(numpy_array)` accepts a numpy array (HWC, uint8, RGB)
- [ ] `client.stream()` returns an async iterator yielding `PredictionResult` objects from the WebSocket endpoint
- [ ] `client.health()` returns server status and loaded model info
- [ ] `client.models()` lists available models on the server
- [ ] Client supports context manager: `with Client() as c: ...` for automatic connection cleanup
- [ ] Async variant: `from openeye_ai import AsyncClient` for `asyncio` usage
- [ ] Connection errors raise `openeye_ai.ConnectionError` with helpful messages (e.g., "Is `openeye serve` running?")
- [ ] Client auto-discovers a local server if no host/port specified (checks `localhost:8000`)
- [ ] Timeout is configurable: `Client(timeout=30)` (default: 10 seconds)

### Edge Cases

- [ ] `client.predict("nonexistent.jpg")` raises `FileNotFoundError` with the full resolved path — does not send a request to the server
- [ ] If the server changes models mid-session (e.g., operator restarts with a different model), `client.predict()` still works — the client does not cache model assumptions
- [ ] Very large images (>50MB) raise `openeye_ai.ImageTooLargeError` client-side before upload, with a configurable `max_image_size` parameter
- [ ] `client.stream()` automatically reconnects on WebSocket disconnect with exponential backoff (max 3 retries, configurable via `stream(retries=3)`)
- [ ] `Client` is **not** thread-safe by default — concurrent `predict()` calls from multiple threads raise `RuntimeError`. Use `AsyncClient` or one `Client` per thread
- [ ] Calling `predict()` during an active `stream()` on the same client raises `openeye_ai.ClientBusyError`
- [ ] If the server has `--api-key` authentication enabled, `Client(api_key="...")` passes the key via `Authorization: Bearer` header. Missing key returns `openeye_ai.AuthenticationError`
- [ ] Supports `HTTP_PROXY` / `HTTPS_PROXY` environment variables via `httpx` proxy configuration
- [ ] `client.predict(numpy_array)` validates shape is 3D (H, W, C) and dtype is `uint8` — raises `ValueError` with a descriptive message for invalid arrays (e.g., float arrays, grayscale without channel dim)
- [ ] Server version mismatch: if `/health` response indicates an incompatible server version, `Client` logs a warning but does not block usage

### Technical Notes

- Uses `httpx` (already a dependency) for HTTP and WebSocket communication
- `PredictionResult` from `schema.py` is reused as the return type — no separate client schema
- Client lives in `cli/openeye_ai/client.py`

### Example Usage

```python
from openeye_ai import Client

client = Client()  # connects to localhost:8000

# Single image
result = client.predict("photo.jpg")
for obj in result.objects:
    print(f"{obj.label}: {obj.confidence:.1%}")

# Streaming
for frame in client.stream():
    if any(o.label == "person" for o in frame.objects):
        print("Person detected!")
```

---

## 86. HTTP REST API

**As a developer, I can integrate OpenEye via a simple HTTP API from any language.**

### Acceptance Criteria

- [ ] `POST /predict` accepts multipart file upload and returns `PredictionResult` JSON (already implemented in `server/app.py`)
- [ ] `POST /predict` also accepts JSON body with base64-encoded image: `{"image": "<base64>", "prompt": "..."}`
- [ ] `GET /health` returns `{"status": "ok", "model": "...", "version": "0.1.0"}` (already implemented)
- [ ] `GET /models` returns a list of available models and their metadata
- [ ] `GET /stream` provides Server-Sent Events (SSE) for continuous detection streaming from a connected camera
- [ ] `POST /predict/batch` accepts multiple images and returns an array of results
- [ ] `GET /docs` serves auto-generated OpenAPI/Swagger documentation (FastAPI built-in)
- [ ] All endpoints return proper HTTP status codes: 200 (success), 400 (bad request), 422 (validation error), 500 (inference error)
- [ ] Response headers include `X-Inference-Ms` with the inference time
- [ ] CORS is enabled by default with configurable origins via `--cors-origins` flag
- [ ] API key authentication is optional via `--api-key` flag on `openeye serve`
- [ ] Rate limiting is configurable via `--rate-limit` (default: no limit)

### Edge Cases

- [ ] Max upload size is enforced (default: 20MB, configurable via `--max-upload-size`). Oversized uploads return `413 Payload Too Large` before reading the full body
- [ ] Malformed base64 in JSON body returns `400 Bad Request` with `{"error": "Invalid base64 image data"}` — does not crash the server
- [ ] Uploading a non-image file (e.g., `.txt`, `.pdf`) returns `422 Unprocessable Entity` with `{"error": "Unsupported image format. Supported: JPEG, PNG, BMP, TIFF, WebP"}`
- [ ] If the camera is not available when `/stream` SSE is requested, returns `503 Service Unavailable` with a message instead of hanging
- [ ] SSE clients that disconnect mid-stream are detected and their resources are cleaned up — no leaked threads or memory
- [ ] Concurrent requests to `/predict` are serialized through the model (single inference at a time) with a configurable request queue depth (`--max-queue`, default: 10). Excess requests return `429 Too Many Requests`
- [ ] Client disconnecting mid-inference: the inference completes but the result is discarded — no crash from writing to a closed connection
- [ ] `/predict/batch` with a mix of valid and invalid images returns partial results: each item has either a `result` or an `error` field
- [ ] `/predict/batch` enforces a max batch size (default: 32) — exceeding it returns `400` with the limit in the error message
- [ ] API key authentication: key is accepted via `Authorization: Bearer <key>` header or `X-API-Key` header — never via query parameter (avoids key leakage in logs)
- [ ] CORS preflight (`OPTIONS`) requests are handled correctly and include `Access-Control-Max-Age: 3600`
- [ ] `Content-Type` validation: `/predict` JSON endpoint rejects non-JSON content types; multipart endpoint rejects non-multipart content types

### Technical Notes

- Extends the existing FastAPI app in `server/app.py`
- SSE streaming uses FastAPI's `StreamingResponse` with `text/event-stream` content type
- OpenAPI docs are auto-generated by FastAPI at `/docs` (Swagger UI) and `/redoc` (ReDoc)

### Example Usage (curl)

```bash
# Single image
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"

# Base64
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"image": "'$(base64 photo.jpg)'"}'

# SSE stream
curl http://localhost:8000/stream
```

---

## 87. gRPC Streaming API

**As a developer, I can use the gRPC API for high-throughput, low-latency streaming integration.**

### Acceptance Criteria

- [ ] `openeye stream --grpc --port 50051` starts a gRPC server with perception streaming
- [ ] Protobuf schema defined in `proto/openeye.proto` with `PerceptionService` containing:
  - `rpc Predict(ImageRequest) returns (PredictionResult)` — unary
  - `rpc StreamDetections(StreamConfig) returns (stream PerceptionFrame)` — server streaming
  - `rpc StreamBidirectional(stream ImageFrame) returns (stream PerceptionFrame)` — bidi streaming
- [ ] `PerceptionFrame` message includes: `timestamp`, `objects[]`, `scene_description`, `depth_map`, `inference_ms`
- [ ] Server-side streaming pushes frames at the configured camera FPS (or model inference rate, whichever is slower)
- [ ] Bidirectional streaming allows clients to send frames and receive results — useful for remote cameras
- [ ] Backpressure handling via `--backpressure` flag: `drop` (default), `buffer`, `block`
- [ ] End-to-end latency from frame capture to client receipt is under 50ms on localhost
- [ ] gRPC reflection is enabled for dynamic client discovery (`grpc_reflection`)
- [ ] Health check service implements the gRPC health checking protocol
- [ ] `grpc` is an optional dependency: `pip install openeye-sh[grpc]` installs `grpcio` and `grpcio-tools`
- [ ] Generated Python stubs are included in the package at `openeye_ai/proto/`
- [ ] Channel options support TLS via `--tls-cert` and `--tls-key` flags

### Edge Cases

- [ ] Max gRPC message size is configurable (`--max-message-size`, default: 16MB). Frames exceeding the limit (e.g., high-res depth maps) are automatically downsampled or compressed with a warning
- [ ] If the camera source is unavailable when `StreamDetections` is called, returns a gRPC `UNAVAILABLE` status with a descriptive message — does not hang
- [ ] Multiple concurrent clients: each client gets its own independent stream. Server tracks total client count and rejects new connections beyond `--max-clients` (default: 10) with `RESOURCE_EXHAUSTED`
- [ ] Client disconnection is detected within 1 second via gRPC keepalive. Resources (buffers, threads) for that client are cleaned up immediately
- [ ] Proto schema evolution: new fields are added as `optional` to maintain backward compatibility. Clients using older proto versions still work
- [ ] gRPC keepalive is configured by default (ping interval: 30s, timeout: 10s) to prevent idle connections from being dropped by intermediate proxies/firewalls
- [ ] `buffer` backpressure mode has a max buffer size (`--buffer-size`, default: 100 frames). If the buffer fills, the oldest frame is evicted and an `overflow_count` field is incremented in the next frame's metadata
- [ ] Bidirectional stream: if the client sends frames faster than inference, server-side queues are bounded — excess frames are dropped with a `FRAME_DROPPED` status in the response stream
- [ ] TLS: if `--tls-cert` is provided without `--tls-key` (or vice versa), exits with a clear error — does not fall back to unencrypted
- [ ] gRPC-Web is not supported in v1 — requests from browser-based gRPC-Web clients return `UNIMPLEMENTED` with a message suggesting the REST/SSE API (story 86) instead
- [ ] Proto `timestamp` uses `google.protobuf.Timestamp` (not string) for cross-language interoperability

### Technical Notes

- Proto file should mirror the `PredictionResult` Pydantic schema for consistency
- Backpressure `drop` mode skips frames if the client can't keep up — logs a warning every 100 dropped frames
- References existing blog post documentation on gRPC streaming architecture

---

## 88. Drone Camera Integration

**As a drone developer, I can connect a drone camera feed and get real-time aerial object detection.**

### Acceptance Criteria

- [ ] `openeye watch --input rtsp://drone:8554/camera` accepts RTSP streams from drone cameras
- [ ] `openeye watch --input mavlink://localhost:14550` accepts MAVLink video streams (e.g., from ArduPilot/PX4)
- [ ] Detections include GPS-projected ground coordinates when telemetry is available via `--telemetry mavlink://...`
- [ ] Camera gimbal angle is factored into coordinate projection (requires gimbal telemetry)
- [ ] Altitude-aware detection: confidence thresholds adjust based on altitude (higher altitude = lower resolution = relaxed thresholds)
- [ ] Supports common drone-relevant detection classes: people, vehicles, buildings, landing pads, obstacles
- [ ] Output includes a top-down projected view option (`--project-to-map`) that maps detections to GPS coordinates
- [ ] Frame stabilization option (`--stabilize`) compensates for drone vibration before inference
- [ ] Latency-optimized mode (`--low-latency`) reduces RTSP buffer to 1 frame for real-time operation
- [ ] Works with DJI (via RTSP), ArduPilot (MAVLink), and PX4 (MAVLink) flight controllers
- [ ] Reconnects automatically if the RTSP stream drops (common during drone maneuvers)
- [ ] `openeye stream --grpc` can forward drone detections to a ground control station

### Edge Cases

- [ ] GPS signal loss: if telemetry reports `fix_type < 3` (no 3D fix), GPS-projected coordinates are omitted from detections and a `gps_unavailable` flag is set — does not output stale/invalid coordinates
- [ ] RTSP authentication: supports credentials in URL (`rtsp://user:pass@drone:8554/camera`) and warns that credentials in URLs may appear in logs
- [ ] Network bandwidth: if RTSP frame rate drops below `--min-fps` (default: 5), logs a bandwidth warning and optionally downsizes the stream resolution (`--auto-downscale`)
- [ ] Altitude = 0 (on ground): GPS projection math guards against division by zero — returns camera-frame-only coordinates with a `ground_level` flag
- [ ] If gimbal telemetry is unavailable, defaults to nadir (straight-down) assumption and logs a warning about coordinate accuracy
- [ ] Night/IR camera feeds: detection models may have degraded accuracy — if average confidence across a frame drops below `--min-avg-confidence` (default: 0.15), logs a warning suggesting IR-trained models
- [ ] Multi-camera drones: `--input` accepts multiple RTSP URLs separated by commas, each processed as a named stream with `--camera-names front,down`
- [ ] RTSP reconnection uses exponential backoff (1s, 2s, 4s, ... up to 30s) with a max retry count (`--max-reconnects`, default: unlimited) — logs each attempt
- [ ] Frame corruption (partial RTSP frames due to packet loss) is detected via decode failure — corrupted frames are dropped silently (logged at debug level) without crashing the pipeline
- [ ] `--low-latency` mode disables RTSP TCP transport and uses UDP — warns that UDP may increase frame corruption on lossy links
- [ ] GPS-denied environments (indoor, underground): if `--telemetry` is set but no GPS data arrives for 10s, falls back to local-frame-only output with a clear log message
- [ ] MAVLink connection: if `--telemetry mavlink://` fails to heartbeat within 5s, exits with a message about MAVLink connection settings (baud rate, protocol version)

### Technical Notes

- RTSP input uses OpenCV's `VideoCapture` with `CAP_FFMPEG` backend
- MAVLink integration uses `pymavlink` (optional dependency: `pip install openeye-sh[drone]`)
- GPS projection requires camera intrinsics + extrinsics + altitude — uses pinhole camera model
- The existing `Camera` class in `utils/camera.py` should be extended with an `RTSPSource` and `MAVLinkSource`

---

## 89. Annotation Export (Label Studio / CVAT)

**As a developer, I can export detection results to Label Studio or CVAT format for annotation workflows.**

### Acceptance Criteria

- [ ] `openeye run yolov8 image.jpg --export label-studio` outputs Label Studio JSON format
- [ ] `openeye run yolov8 image.jpg --export cvat` outputs CVAT XML format
- [ ] `openeye watch --export label-studio --output detections/` saves per-frame annotation files during live inference
- [ ] Label Studio export includes: image reference, bounding boxes (as percentages), labels, confidence scores, model name as annotator
- [ ] CVAT export includes: image metadata, bounding boxes (pixel coordinates), labels, CVAT-compatible task/job structure
- [ ] Batch export: `openeye run yolov8 images/ --export label-studio --output annotations.json` processes a directory
- [ ] Export includes pre-annotation metadata so Label Studio/CVAT treat results as "predictions" (not ground truth) for human review
- [ ] Confidence threshold filter: `--min-confidence 0.5` excludes low-confidence detections from export
- [ ] Supports both Label Studio JSON and Label Studio CSV formats
- [ ] CVAT export supports CVAT for Images 1.1 XML schema
- [ ] Export preserves original image paths for re-linking in the annotation tool
- [ ] `--export coco` is also supported for COCO JSON format (bonus format)

### Edge Cases

- [ ] Images with zero detections: export still creates a valid entry (empty `predictions` array for Label Studio, `<image>` with no `<box>` children for CVAT) so the image appears in the annotation tool for manual labeling
- [ ] If the original image file has been moved or deleted since detection, the export includes the original path and logs a warning — does not fail the entire batch
- [ ] Labels containing special characters (quotes, angle brackets, unicode) are properly escaped for JSON and XML output — no injection or parse errors
- [ ] Batch export of >1000 images: streams output to file incrementally (not buffered in memory) to avoid OOM on large datasets
- [ ] If `--output` target file already exists, prompts for confirmation (`--overwrite` flag to skip prompt). Default: refuse to overwrite
- [ ] `Ctrl+C` during `--export` in `watch` mode: flushes any buffered annotations to disk before exiting — no partial/corrupt JSON or XML
- [ ] Video frame exports include a `frame_index` field so annotation tools can link back to the source video timestamp
- [ ] COCO format: generates contiguous category IDs starting at 1, with a `categories` mapping — even if detection labels are non-contiguous strings
- [ ] Bounding boxes that extend outside image boundaries (due to model output noise) are clipped to `[0, 0, width, height]` before export
- [ ] If `--export` is combined with `--models` using multiple models, each model's predictions are exported as a separate annotator/source in the Label Studio format
- [ ] Empty `--output` directory is created automatically if it doesn't exist (with `mkdir -p` behavior)
- [ ] Label Studio export includes a default `<View>` label config XML alongside the annotations for easy project import

### Technical Notes

- Label Studio JSON format: each task has `data.image` (path/URL) and `predictions[].result[]` with `rectanglelabels` type
- CVAT XML: `<annotations>` → `<image>` → `<box label="..." xtl="" ytl="" xbr="" ybr="" />`
- BBox conversion: `schema.py` `BBox` (normalized x,y,w,h) must be converted to each format's coordinate system
- Export logic lives in `cli/openeye_ai/exporters/` with `label_studio.py`, `cvat.py`, `coco.py`

### Example Usage

```bash
# Single image → Label Studio
openeye run yolov8 warehouse.jpg --export label-studio > task.json

# Batch → CVAT
openeye run yolov8 frames/ --export cvat --output annotations.xml

# Live capture → annotation files
openeye watch --models yolov8 --export label-studio --output session/
```

---

## 90. Edge / ARM Device Support (NVIDIA Jetson)

**As a developer, I can use OpenEye with NVIDIA Jetson / edge devices with ARM support.**

### Acceptance Criteria

- [ ] `pip install openeye-sh` installs and runs on `aarch64` (ARM64) Linux — tested on Jetson Orin Nano, Orin NX, AGX Orin
- [ ] All core CLI commands (`list`, `pull`, `run`, `serve`, `watch`) work on ARM64 without modification
- [ ] YOLO adapter uses TensorRT backend when available on Jetson (`--backend tensorrt`), falling back to PyTorch
- [ ] TensorRT engine files are cached after first conversion at `~/.openeye/models/<model>/tensorrt/`
- [ ] `openeye run yolov8 image.jpg` achieves ≥ 30 FPS on Jetson Orin Nano with TensorRT
- [ ] GPU memory usage is reported via `openeye status` showing VRAM utilization
- [ ] Half-precision (FP16) inference is the default on Jetson; configurable via `--precision fp16|fp32|int8`
- [ ] INT8 quantization is supported with calibration: `openeye quantize yolov8 --precision int8 --calibration-data images/`
- [ ] `openeye serve` works on Jetson with the same REST/WebSocket API as x86
- [ ] Docker image provided: `ghcr.io/openeye-sh/openeye:jetson` based on `nvcr.io/nvidia/l4t-pytorch`
- [ ] JetPack 5.x and 6.x are supported
- [ ] Power mode awareness: `openeye watch --power-mode maxn` sets Jetson power mode before inference
- [ ] Temperature monitoring: warns if device thermal throttling is detected during inference
- [ ] Cross-compilation support: models can be exported to TensorRT on x86 with `--target jetson-orin`
- [ ] Also works on Raspberry Pi 5 with CPU-only inference (no TensorRT, ~2-5 FPS with YOLO)

### Edge Cases

- [ ] CUDA version mismatch between JetPack and PyTorch: on startup, checks `torch.version.cuda` against the system CUDA version and warns if they differ — suggests the correct PyTorch wheel URL
- [ ] TensorRT engine conversion can require up to 4x the model's GPU memory — if conversion OOMs, catches the error and suggests reducing `--workspace-size` or using FP16 instead of INT8
- [ ] TensorRT engines are tied to a specific GPU architecture — engine files are namespaced by compute capability (e.g., `tensorrt/sm87/model.engine`). Engines built on Orin NX won't silently load on Orin Nano
- [ ] SD card I/O bottleneck (Jetson Nano): if model loading takes >30s, logs a suggestion to move models to NVMe/USB storage
- [ ] Headless operation (no display): `openeye watch` works in headless mode by default — no X11/display dependency. OpenCV GUI windows are disabled unless `--show` is explicitly set
- [ ] If `jetson-stats` (`jtop`) is not installed, `openeye status` reports GPU metrics as "unavailable" instead of crashing
- [ ] Thermal throttling detection: if GPU clock drops below 70% of max during inference, logs a `THERMAL_THROTTLE` warning with the current temperature
- [ ] Auto-recovery after thermal throttling: inference continues at reduced throughput — does not crash or halt. Logs when clocks recover to normal
- [ ] TensorRT engine input size is locked at build time — if the user passes an image with a different resolution than the engine was built for, auto-resizes the input and logs a warning about potential accuracy loss
- [ ] Dynamic batch size: TensorRT engines are built with `--max-batch-size` (default: 1). Batch sizes exceeding the engine's max fall back to PyTorch with a warning
- [ ] Raspberry Pi 5 with Hailo-8L accelerator: if `hailort` is detected, uses Hailo backend for ~15 FPS YOLO (vs ~3 FPS CPU-only) — optional dependency `pip install openeye-sh[hailo]`
- [ ] Multi-process: if two OpenEye instances try to use the same GPU, the second instance gets a clear `CUDA out of memory` error with a message about GPU sharing limitations
- [ ] `openeye pull` on Jetson: downloads ARM-compatible weights only. If a model only has x86 ONNX weights, fails with a message about unsupported architecture rather than downloading and failing at load time
- [ ] Container vs native: detects if running inside Docker and adjusts device paths (`/dev/video*`, `/dev/nvhost-*`) — warns if GPU devices are not mapped into the container

### Technical Notes

- Jetson-specific dependencies: `tensorrt`, `pycuda`, `jetson-stats` (for monitoring)
- Optional dependency group: `pip install openeye-sh[jetson]`
- The `ModelAdapter` base class should support a `backend` parameter to switch between PyTorch/TensorRT/ONNX
- ARM wheels for `torch`, `torchvision` are available from NVIDIA's PyPI index
- CI should include an ARM64 build target (can use QEMU for GitHub Actions)

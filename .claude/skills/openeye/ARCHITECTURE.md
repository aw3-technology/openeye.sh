# OpenEye Architecture

## Backend Perception Pipeline

Located in `backend/src/perception/`. Processes frames through a multi-stage pipeline:

```
Input Frame
  → ROI Crop (if configured)
  → Lighting Normalization (CLAHE)
  → Detection (YOLO or provided)
  → Depth Estimation (if depth_estimator provided)
  → Object Tracking (IOU-based, persistent track_id)
  → 3D Position Estimation (from depth map)
  → Grasp Point Suggestion (for manipulable objects)
  → Floor Plane Estimation
  → Scene Graph Generation (spatial relationships)
  → Safety Evaluation (danger/caution zones)
  → Change Detection
  → Action Suggestions
  → PerceptionFrame Output
```

### PerceptionPipeline Constructor

```python
PerceptionPipeline(
    detector,                    # callable(frame) → List[dict] with label, confidence, bbox
    depth_estimator=None,        # callable(frame) → depth map (H×W)
    iou_threshold=0.3,
    danger_m=0.5,                # Danger zone radius (meters)
    caution_m=1.5,               # Caution zone radius (meters)
    robot_goal=None,             # Context for action suggestions
    lighting_robustness=True     # Enable CLAHE normalization
)
```

### Key Methods

- `process_frame(frame, detections, depth_map)` → `PerceptionFrame`
- `set_roi(RegionOfInterest)` — Focus on sub-region
- `set_goal(str)` — Update robot goal for action suggestions
- `query(question)` → `NLQueryResult` — Natural language scene queries

### PerceptionFrame Output

```python
PerceptionFrame:
  frame_id: int
  timestamp: float
  inference_ms: float
  objects: List[DetectedObject3D]     # With track_id, position_3d, grasp_points
  scene_graph: SceneGraphData         # Spatial relationships between objects
  scene_description: str
  safety_alerts: List[SafetyAlert]
  safety_zones: List[SafetyZone]
  action_suggestions: List[ActionSuggestion]
  change_alerts: List[ChangeAlert]
  floor_plane: FloorPlane
  depth_available: bool
  roi: Optional[RegionOfInterest]
```

Latency target: <100ms per frame (warns if exceeded).

---

## Plugin Architecture

All components use a discovery-based plugin pattern. Plugins are loaded dynamically from their respective directories.

### Input Plugins (`backend/src/inputs/`)

Base class: `Sensor[ConfigType, RawType]`

| Plugin | Type String | Purpose |
|--------|-------------|---------|
| `VLMOpenAI` | `VLMOpenAI` | Cloud vision via OpenAI GPT-4o-mini |
| `VLMGemini` | `VLMGemini` | Google Gemini vision |
| `VLMLocalYOLO` | `VLMLocalYOLO` | Local YOLO v8 detection |
| `VLMVideoFile` | `VLMVideoFile` | Video file input |
| `PerceptionPipeline` | `PerceptionPipeline` | Unified perception output |

Key methods:
- `async _raw_to_text(raw_input)` → `Message`
- `formatted_latest_buffer()` → `str`
- `async listen()` → `AsyncIterator[RawType]`
- `stop()`

### Action Plugins (`backend/src/actions/`)

Base class: `ActionConnector[ConfigType, OutputType]`

| Plugin | Name | Purpose |
|--------|------|---------|
| `log_action` | `log` | Log to console |

Key methods:
- `async connect(output_interface)` — Execute action
- `tick()` — Periodic update
- `stop()`

### LLM Plugins (`backend/src/llm/`)

Base class: `LLM[R]`

| Plugin | Type String | Purpose |
|--------|-------------|---------|
| `OpenAILLM` | `OpenAILLM` | OpenAI GPT-4o-mini |
| `NebiusLLM` | `NebiusLLM` | Nebius Token Factory (Qwen/Llama models) |
| `OpenRouterLLM` | `OpenRouterLLM` | OpenRouter API (free model fallbacks: Qwen3-VL, Nemotron, Gemma-3) |

Config:
```python
LLMConfig:
  base_url: Optional[str]
  api_key: Optional[str]
  model: Optional[str]
  timeout: int = 10
  agent_name: str = "IRIS"
  history_length: int = 0
  extra_params: Dict[str, Any]
```

### Simulator Plugins (`backend/src/simulators/`)

Base class: `Simulator`

| Plugin | Purpose |
|--------|---------|
| `WebSim` | WebSocket-based simulator |

---

## Mode / Runtime System

Located in `backend/src/runtime/`. Supports multi-mode operation with dynamic transitions.

### Configuration Hierarchy

```
ModeSystemConfig (top-level)
  ├── version, name, default_mode
  ├── allow_manual_switching, mode_memory_enabled
  ├── api_key, robot_ip, URID, unitree_ethernet
  ├── system_governance              # Global rules/constraints
  ├── system_prompt_examples
  ├── knowledge_base                 # FAISS semantic search
  ├── global_cortex_llm              # Shared LLM config
  ├── global_lifecycle_hooks
  ├── modes: Dict[str, ModeConfig]
  └── transition_rules: List[TransitionRule]

ModeConfig (per-mode)
  ├── display_name, description
  ├── system_prompt_base
  ├── hertz                          # Ticks per second
  ├── timeout_seconds
  ├── agent_inputs: List[Sensor]
  ├── cortex_llm: Optional[LLM]
  ├── agent_actions: List[AgentAction]
  ├── simulators, backgrounds
  └── lifecycle_hooks
```

### Mode Transitions

```python
TransitionType:
  INPUT_TRIGGERED    # Keywords in input text
  TIME_BASED         # Mode timeout
  CONTEXT_AWARE      # User context conditions
  MANUAL             # User-triggered

TransitionRule:
  from_mode: str           # or "*" for any
  to_mode: str
  transition_type: TransitionType
  trigger_keywords: List[str]
  priority: int            # Higher wins (1-10+)
  cooldown_seconds: float
  timeout_seconds: Optional[float]
  context_conditions: Dict
```

ModeManager key methods:
- `async request_transition(target_mode, reason)` → `bool`
- `check_input_triggered_transitions(input_text)` → `Optional[str]`
- `get_available_transitions()` → `List[str]`
- `update_user_context(context: Dict)`

State persisted to `.runtime.json5` in `config/memory/`.

### Lifecycle Hooks

```python
LifecycleHookType:
  ON_STARTUP      # System/mode startup
  ON_SHUTDOWN     # System/mode shutdown
  ON_ENTRY        # Mode transition entry
  ON_EXIT         # Mode transition exit
  ON_TIMEOUT      # Mode timeout reached
```

Hook handler types (how hooks execute):

| Handler | Config Fields | Purpose |
|---------|---------------|---------|
| `MessageHookHandler` | `message` | Log a formatted message |
| `CommandHookHandler` | `command` | Execute a shell command |
| `FunctionHookHandler` | `module_name`, `function` | Call custom Python function from hooks directory |
| `ActionHookHandler` | `action_type`, `action_config` | Execute an action via the action system |

---

## Cortex Processing Loop

The main runtime loop in `ModeCortexRuntime`:

```
Startup:
  1. Load ModeSystemConfig from JSON5
  2. Execute ON_STARTUP hooks
  3. Initialize default mode (load all components)
  4. Start orchestrators (Input, Simulator, Action, Background)
  5. Start gRPC server
  6. Enter cortex loop

Per-Tick Cycle (runs at `hertz` rate):
  1. Flush finished action promises
  2. Fuse inputs into prompt (system prompt + sensor buffers + knowledge base + governance + action schemas)
  3. Check mode transitions (time-based → context-aware → input-triggered)
  4. If transition pending → schedule & skip LLM
  5. Call LLM.ask(prompt)
  6. Parse actions from LLM response
  7. Execute action promises
  8. Simulate (if simulator present)
```

---

## Event Bus (Pub/Sub)

Singleton shared across all components.

```python
EventType:
  # Perception
  DETECTION, SCENE_DESCRIPTION, FRAME_CAPTURED, CAMERA_STATUS, ERROR

  # Fleet
  DEVICE_REGISTERED, DEVICE_STATUS_CHANGED, DEVICE_HEARTBEAT,
  DEVICE_OFFLINE, DEVICE_DECOMMISSIONED, DEPLOYMENT_CREATED,
  DEPLOYMENT_STAGE_ADVANCED, DEPLOYMENT_COMPLETED,
  DEPLOYMENT_ROLLED_BACK, DEPLOYMENT_FAILED,
  FLEET_ALERT, OTA_UPDATE_QUEUED, MAINTENANCE_WINDOW_STARTED
```

Usage:
```python
event_bus.subscribe(EventType.DETECTION, callback)
event_bus.publish(DetectionEvent(...))
```

gRPC integration: `PerceptionServicer` subscribes to `DETECTION` events and streams to clients via thread-safe queues (max 100 frames buffered, drops for slow subscribers).

---

## Adapter System (CLI)

Located in `cli/openeye_ai/adapters/`. Base class: `ModelAdapter` (`adapters/base.py`).

### Base Class

```python
class ModelAdapter(ABC):
    def load(self, model_dir: Path) → None        # Calls _do_load, sets _loaded
    def predict(self, image: Image) → dict         # Calls _do_predict (raises if not loaded)

    @abstractmethod
    def _do_load(self, model_dir: Path) → None
    @abstractmethod
    def _do_predict(self, image: Image) → dict
    @abstractmethod
    def pull(self, model_dir: Path) → None
```

### Adapter Map

```python
"yolov8"            → openeye_ai.adapters.yolov8
"depth_anything"    → openeye_ai.adapters.depth_anything
"grounding_dino"    → openeye_ai.adapters.grounding_dino
"yolov8:onnx"       → openeye_ai.adapters.yolov8_onnx
"onnx_generic"      → openeye_ai.adapters.onnx_runtime
"yolov8:tensorrt"   → openeye_ai.adapters.tensorrt_runtime
"tensorrt_generic"  → openeye_ai.adapters.tensorrt_runtime
```

### Custom Adapter Resolution

If the `adapter` field in the registry contains `/` or ends with `.py`, it's loaded as a custom adapter file via `openeye_ai.utils.custom_adapter.load_custom_adapter()`.

---

## Configuration Files

Located in `backend/config/`. Format: JSON5 (supports comments, unquoted keys).

Environment variable substitution: `${ENV_VAR}` or `${ENV_VAR:-default}`.

Example configs:
- `openeye_vlm.json5` — Cloud VLM with OpenAI
- `openeye_vlm_gemini.json5` — Google Gemini
- `openeye_yolo.json5` — Local YOLO detection
- `openeye_video.json5` — Video file input

Schema validation: `config/schema/single_mode_schema.json`, `config/schema/multi_mode_schema.json`.

### Starting the Runtime

```bash
python src/run.py [config_name] \
  --hot-reload \
  --check-interval 60 \
  --log-level INFO \
  --grpc-port 50051 \
  --log-to-file
```

---

## Data Flow Summary

```
Camera/Video → Input Plugin → Fuser → LLM → Actions
                   ↓                           ↓
            PerceptionPipeline          Action Connectors
                   ↓                           ↓
            EventBus.publish()          Simulator (optional)
                   ↓
            gRPC StreamDetections
                   ↓
        Frontend WebSocket/React Query
```

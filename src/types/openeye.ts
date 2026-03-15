/** TypeScript mirrors of cli/openeye_ai/schema.py Pydantic models + Supabase row types. */

// --- Prediction schemas (mirror of schema.py) ---

export interface BBox {
  x: number; // left edge, normalized 0-1
  y: number; // top edge, normalized 0-1
  w: number; // width, normalized 0-1
  h: number; // height, normalized 0-1
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: BBox;
}

export interface ImageInfo {
  width: number;
  height: number;
  source: string;
}

export interface SegmentationMask {
  mask: string; // base64 PNG
  area: number;
  bbox: BBox;
  stability_score: number;
}

export interface PredictionResult {
  model: string;
  task: string;
  timestamp: string;
  image: ImageInfo;
  objects: DetectedObject[];
  depth_map?: string | null; // base64 PNG
  segmentation_masks?: SegmentationMask[] | null;
  vla_action?: number[] | null;
  inference_ms: number;
}

// --- Server endpoints ---

export interface HealthResponse {
  status: string;
  model: string;
}

export interface ModelParameters {
  confidence_threshold: number;
  nms_threshold: number;
  max_detections: number;
  class_filter: string[];
}

export interface PerformanceMetrics {
  fps: number;
  latency_ms: number;
  frame_count: number;
  gpu_usage?: number;
}

export interface RuntimeConfig {
  modes?: string[];
  cortex_llm?: string;
  vlm_model?: string;
  system_prompts?: Record<string, string>;
  hertz?: number;
  [key: string]: unknown;
}

// --- Supabase row types ---

export interface InferenceHistoryRow {
  id: string;
  user_id: string;
  model: string;
  task: string;
  timestamp: string;
  image_width: number;
  image_height: number;
  image_source: string;
  object_count: number;
  objects_json: string; // JSON stringified DetectedObject[]
  inference_ms: number;
  thumbnail_url?: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_at: string;
  last_used_at?: string | null;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  device_type: string;
  server_url: string;
  last_seen_at?: string | null;
  created_at: string;
}

// --- Perception pipeline types (mirror of backend/src/perception/models.py) ---

export type ZoneLevel = "safe" | "caution" | "danger";
export type RelationType = "ON" | "UNDER" | "NEAR" | "LEFT_OF" | "RIGHT_OF" | "ABOVE" | "BELOW" | "INSIDE" | "BEHIND" | "IN_FRONT_OF";
export type ChangeType = "object_appeared" | "object_disappeared" | "object_moved" | "scene_changed";

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface BBox2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraspPoint {
  object_track_id: string;
  position: Position3D;
  approach_vector: [number, number, number];
  width_m: number;
  confidence: number;
}

export interface DetectedObject3D {
  track_id: string;
  label: string;
  confidence: number;
  bbox: BBox2D;
  position_3d?: Position3D | null;
  depth_m?: number | null;
  is_manipulable: boolean;
  grasp_points: GraspPoint[];
}

export interface SpatialRelationship {
  subject_id: string;
  relation: RelationType;
  object_id: string;
  confidence: number;
}

export interface SceneGraphNode {
  track_id: string;
  label: string;
  position_3d?: Position3D | null;
  children: string[];
}

export interface SceneGraphData {
  nodes: SceneGraphNode[];
  relationships: SpatialRelationship[];
  root_id: string;
}

export interface SafetyZone {
  human_track_id: string;
  zone: ZoneLevel;
  distance_m: number;
  bearing_deg: number;
}

export interface SafetyAlert {
  human_track_id: string;
  zone: ZoneLevel;
  distance_m: number;
  message: string;
  halt_recommended: boolean;
}

export interface ChangeAlert {
  change_type: ChangeType;
  description: string;
  affected_track_ids: string[];
  magnitude: number;
}

export interface ActionSuggestion {
  action: string;
  target_id?: string | null;
  reason: string;
  priority: number;
}

export interface PerceptionFrame {
  frame_id: number;
  timestamp: number;
  inference_ms: number;
  objects: DetectedObject3D[];
  scene_graph: SceneGraphData;
  scene_description: string;
  safety_alerts: SafetyAlert[];
  safety_zones: SafetyZone[];
  action_suggestions: ActionSuggestion[];
  change_alerts: ChangeAlert[];
  floor_plane?: { normal: [number, number, number]; height: number; confidence: number } | null;
  depth_available: boolean;
  roi?: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface VLMReasoning {
  description: string;
  reasoning: string;
  latency_ms: number;
}

export interface RecordedFrame {
  timestamp: number;
  frame_base64: string;
  perception: PerceptionFrame;
  vlm?: VLMReasoning | null;
}

export interface RecordingSession {
  id: string;
  started_at: number;
  frames: RecordedFrame[];
}

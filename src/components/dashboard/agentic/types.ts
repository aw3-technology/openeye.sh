export interface AgenticDetection {
  track_id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | { x1: number; y1: number; x2: number; y2: number };
  is_manipulable?: boolean;
}

export interface AgenticVLMReasoning {
  description: string;
  reasoning: string;
  latency_ms: number;
}

export interface AgenticActionStep {
  action: string;
  target_id?: string | null;
  reason: string;
  priority: number;
}

export interface TimelineEvent {
  timestamp: number;
  event: string;
  details: string;
}

export interface MemorySnapshot {
  objects_seen: Record<string, { label: string; frames_seen: number; seconds_tracked: number }>;
  timeline: TimelineEvent[];
  frame_count: number;
  total_objects_tracked: number;
}

export interface AgenticLatency {
  detection_ms: number;
  vlm_ms: number;
  total_ms: number;
}

export interface AgenticFrame {
  type: "agentic_frame";
  frame_id: number;
  goal: string;
  detections: AgenticDetection[];
  scene_graph: Record<string, unknown>;
  scene_description: string;
  vlm_reasoning: AgenticVLMReasoning | null;
  action_plan: AgenticActionStep[];
  safety_zones: Array<{ zone: string; distance_m: number }>;
  safety_alerts: Array<{ message: string; zone: string; halt_recommended: boolean }>;
  change_alerts: Array<{ change_type: string; description: string }>;
  memory: MemorySnapshot;
  latency: AgenticLatency;
}

export interface AgenticLoopProps {
  /** Ref to the video element for frame capture */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** External control: whether the camera is streaming */
  isStreaming: boolean;
  /** Callback with latest detections for overlay rendering */
  onDetections?: (detections: AgenticDetection[]) => void;
  /** Callback when agent running state changes */
  onRunningChange?: (running: boolean) => void;
}

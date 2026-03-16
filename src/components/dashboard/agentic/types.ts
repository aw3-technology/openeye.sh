import type {
  VLMReasoning,
  ActionSuggestion,
  SafetyAlert,
  SafetyZone,
  ChangeAlert,
} from "@/types/openeye";

export interface AgenticDetection {
  track_id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | { x1: number; y1: number; x2: number; y2: number };
  is_manipulable?: boolean;
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
  vlm_reasoning: VLMReasoning | null;
  action_plan: ActionSuggestion[];
  safety_zones: SafetyZone[];
  safety_alerts: SafetyAlert[];
  change_alerts: ChangeAlert[];
  memory: MemorySnapshot;
  latency: AgenticLatency;
}

/** @deprecated Use VLMReasoning from @/types/openeye */
export type AgenticVLMReasoning = VLMReasoning;
/** @deprecated Use ActionSuggestion from @/types/openeye */
export type AgenticActionStep = ActionSuggestion;

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

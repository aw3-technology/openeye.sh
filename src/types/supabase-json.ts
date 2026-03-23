/**
 * Typed interfaces for Supabase JSON columns.
 * Replaces loose `Json` and `Record<string, unknown>` usage with narrower types
 * that describe the actual shape stored in each JSON column.
 */

/** devices.config_overrides JSON column */
export interface DeviceConfigOverrides {
  modes?: string[];
  confidence_threshold?: number;
  danger_m?: number;
  caution_m?: number;
  iou_threshold?: number;
  lighting_robustness?: boolean;
  vlm_model?: string;
  cortex_llm?: string;
  hertz?: number;
  [key: string]: unknown;
}

/** devices.hardware_specs JSON column */
export interface DeviceHardwareSpecs {
  cpu?: string;
  gpu?: string;
  ram_gb?: number;
  storage_gb?: number;
  accelerator?: string;
  [key: string]: unknown;
}

/** devices.tags JSON column */
export type DeviceTags = Record<string, string>;

/** devices.metadata JSON column */
export interface DeviceMetadata {
  [key: string]: unknown;
}

/** deployments.rollout_stages JSON column */
export interface RolloutStageJson {
  name: string;
  percentage: number;
  status: string;
  started_at?: string;
  completed_at?: string;
}

/** device_groups.tag_filter JSON column */
export type TagFilter = Record<string, string>;

/** inference_history.result JSON column */
export interface InferenceResult {
  objects?: Array<{
    label: string;
    confidence: number;
    bbox: { x: number; y: number; w: number; h: number };
  }>;
  model?: string;
  inference_ms?: number;
  [key: string]: unknown;
}

import type { ModelParameters } from "@/types/openeye";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";

// ── Types ───────────────────────────────────────────────────────────────────

export interface InferenceParams {
  device: string;
  precision: string;
  batch_size: number;
  warmup: boolean;
  tensorrt: boolean;
}

export interface VlmParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
  vlm_model: string;
  cortex_llm: string;
}

export interface StreamParams {
  hertz: number;
  auto_reconnect: boolean;
  buffer_frames: number;
}

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_DETECTION: ModelParameters = {
  confidence_threshold: 0.5,
  nms_threshold: 0.45,
  max_detections: 100,
  class_filter: [],
};

export const DEFAULT_INFERENCE: InferenceParams = {
  device: "cpu",
  precision: "fp32",
  batch_size: 1,
  warmup: true,
  tensorrt: false,
};

export const DEFAULT_VLM: VlmParams = {
  temperature: 0.7,
  max_tokens: 512,
  top_p: 0.9,
  vlm_model: "",
  cortex_llm: "",
};

export const DEFAULT_STREAM: StreamParams = {
  hertz: 10,
  auto_reconnect: true,
  buffer_frames: 3,
};

// ── Storage keys ────────────────────────────────────────────────────────────

export const STORAGE_KEY = "openeye_model_params";
export const INFERENCE_KEY = "openeye_inference_params";
export const VLM_KEY = "openeye_vlm_params";
export const STREAM_KEY = "openeye_stream_params";

// ── Constants ───────────────────────────────────────────────────────────────

export const NONE_VALUE = "__none__";

export const DETECTION_MODELS = [
  { id: "yolov8n", label: "YOLOv8 Nano", size: "6 MB", speed: "fastest" },
  { id: "yolov8s", label: "YOLOv8 Small", size: "22 MB", speed: "fast" },
  { id: "yolov8m", label: "YOLOv8 Medium", size: "52 MB", speed: "balanced" },
  { id: "yolov8l", label: "YOLOv8 Large", size: "87 MB", speed: "accurate" },
  { id: "yolov8x", label: "YOLOv8 XLarge", size: "131 MB", speed: "most accurate" },
  { id: "yolo26n", label: "YOLO26 Nano", size: "5 MB", speed: "fastest" },
  { id: "yolo26s", label: "YOLO26 Small", size: "18 MB", speed: "fast" },
  { id: "rf-detr-base", label: "RF-DETR Base", size: "130 MB", speed: "accurate" },
  { id: "grounding-dino", label: "Grounding DINO", size: "680 MB", speed: "open-vocab" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function groupByProvider(options: typeof vlmModelOptions) {
  const groups: Record<string, typeof vlmModelOptions> = {};
  for (const m of options) {
    (groups[m.provider] ??= []).push(m);
  }
  return groups;
}

export const vlmByProvider = groupByProvider(vlmModelOptions);
export const cortexByProvider = groupByProvider(cortexLlmOptions);

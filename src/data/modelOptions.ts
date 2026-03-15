/** Selectable model options for dashboard config dropdowns. */

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  free?: boolean;
}

/** VLM / multimodal models (for perception VLM layer). */
export const vlmModelOptions: ModelOption[] = [
  // OpenRouter
  { id: "qwen/qwen3-vl-235b:free", label: "Qwen3-VL 235B", provider: "OpenRouter", free: true },
  { id: "qwen/qwen3.5-9b", label: "Qwen3.5-9B", provider: "OpenRouter" },
  { id: "openrouter/healer-alpha", label: "Healer Alpha", provider: "OpenRouter", free: true },
  { id: "bytedance-seed/seed-2.0-lite", label: "Seed-2.0-Lite", provider: "OpenRouter" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", provider: "OpenRouter" },
  { id: "nvidia/nemotron-nano-12b-vl:free", label: "Nemotron Nano 12B VL", provider: "OpenRouter", free: true },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B", provider: "OpenRouter", free: true },
  // Nebius
  { id: "Qwen/Qwen3-VL-72B", label: "Qwen3-VL 72B", provider: "Nebius" },
  { id: "moonshot-ai/Kimi-K2.5", label: "Kimi-K2.5", provider: "Nebius" },
];

/** Cortex LLM models (for reasoning / planning layer). */
export const cortexLlmOptions: ModelOption[] = [
  // OpenRouter — Agentic Reasoning
  { id: "z-ai/glm-5-turbo", label: "GLM-5 Turbo", provider: "OpenRouter" },
  { id: "openrouter/hunter-alpha", label: "Hunter Alpha", provider: "OpenRouter", free: true },
  { id: "nvidia/nemotron-3-super:free", label: "Nemotron 3 Super", provider: "OpenRouter", free: true },
  // Nebius — LLM Reasoning
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", label: "Qwen3-235B", provider: "Nebius" },
  { id: "deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek-V3.2", provider: "Nebius" },
  { id: "Qwen/Qwen3-Next-80B-A14B-Instruct", label: "Qwen3-Next-80B", provider: "Nebius" },
  { id: "marcusaurelius/GPT-OSS-120B", label: "GPT-OSS-120B", provider: "Nebius" },
  // OpenRouter — General
  { id: "qwen/qwen3-vl-235b:free", label: "Qwen3-VL 235B (vision+reasoning)", provider: "OpenRouter", free: true },
];

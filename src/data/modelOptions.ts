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
  { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super VL", provider: "OpenRouter", free: true },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", provider: "OpenRouter", free: true },
  { id: "qwen/qwen3-vl-235b-a22b-instruct", label: "Qwen3-VL 235B", provider: "OpenRouter" },
  { id: "qwen/qwen3.5-9b", label: "Qwen3.5-9B", provider: "OpenRouter" },
  { id: "bytedance-seed/seed-2.0-lite", label: "Seed-2.0-Lite", provider: "OpenRouter" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", provider: "OpenRouter" },
  // Nebius
  { id: "Qwen/Qwen2.5-VL-72B-Instruct", label: "Qwen2.5-VL 72B", provider: "Nebius" },
  { id: "moonshot-ai/Kimi-K2.5", label: "Kimi-K2.5", provider: "Nebius" },
];

/** Cortex LLM models (for reasoning / planning layer). */
export const cortexLlmOptions: ModelOption[] = [
  // OpenRouter — Agentic Reasoning
  { id: "z-ai/glm-5-turbo", label: "GLM-5 Turbo", provider: "OpenRouter" },
  // Nebius — LLM Reasoning
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", label: "Qwen3-235B", provider: "Nebius" },
  { id: "deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek-V3.2", provider: "Nebius" },
  { id: "Qwen/Qwen3-Next-80B-A14B-Instruct", label: "Qwen3-Next-80B", provider: "Nebius" },
  { id: "marcusaurelius/GPT-OSS-120B", label: "GPT-OSS-120B", provider: "Nebius" },
  // OpenRouter — General
  { id: "qwen/qwen3-vl-235b-a22b-instruct", label: "Qwen3-VL 235B (vision+reasoning)", provider: "OpenRouter" },
];

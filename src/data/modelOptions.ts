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
  { id: "qwen/qwen-2.5-vl-72b-instruct:free", label: "Qwen2.5-VL 72B", provider: "OpenRouter", free: true },
  { id: "meta-llama/llama-3.2-90b-vision-instruct", label: "Llama 3.2 Vision 90B", provider: "OpenRouter" },
  { id: "mistralai/pixtral-12b-2409", label: "Pixtral 12B", provider: "OpenRouter" },
  { id: "deepseek/deepseek-vl2", label: "DeepSeek-VL2", provider: "OpenRouter" },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B", provider: "OpenRouter", free: true },
  // Nebius
  { id: "Qwen/Qwen2.5-VL-72B-Instruct", label: "Qwen2.5-VL 72B", provider: "Nebius" },
  { id: "moonshot-ai/Kimi-K2.5", label: "Kimi-K2.5", provider: "Nebius" },
];

/** Cortex LLM models (for reasoning / planning layer). */
export const cortexLlmOptions: ModelOption[] = [
  // OpenRouter — Agentic Reasoning
  { id: "zhipu-ai/glm-4-plus", label: "GLM-4", provider: "OpenRouter" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "OpenRouter", free: true },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B", provider: "OpenRouter", free: true },
  // Nebius — LLM Reasoning
  { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5-72B", provider: "Nebius" },
  { id: "deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek-V3", provider: "Nebius" },
  { id: "meta-llama/Llama-3.1-70B-Instruct", label: "Llama 3.1 70B", provider: "Nebius" },
  { id: "mistralai/Mixtral-8x22B-Instruct-v0.1", label: "Mixtral 8x22B", provider: "Nebius" },
  // OpenRouter — General
  { id: "qwen/qwen-2.5-vl-72b-instruct:free", label: "Qwen2.5-VL 72B (vision+reasoning)", provider: "OpenRouter", free: true },
];

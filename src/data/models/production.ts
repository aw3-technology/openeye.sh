import type { ProductionModel } from "./types";

export const productionModels: ProductionModel[] = [
  { name: "YOLO26", role: "Fast detection", stat: "30fps" },
  { name: "SAM 2", role: "Segmentation", stat: "Zero-shot" },
  { name: "Qwen2.5-VL", role: "VLM reasoning", stat: "Nebius / OpenRouter" },
  { name: "Grounding DINO", role: "Open-set grounding", stat: "Text-prompted" },
  { name: "RF-DETR", role: "Detection transformer", stat: "No NMS" },
  { name: "SmolVLA", role: "Robot actions", stat: "Real-time" },
  { name: "Depth Anything V2", role: "Depth estimation", stat: "Monocular" },
  { name: "Llama 3.2 Vision", role: "Multimodal VLM", stat: "OpenRouter" },
  { name: "Pixtral 12B", role: "Natively multimodal", stat: "OpenRouter" },
  { name: "DeepSeek-VL2", role: "MoE vision-language", stat: "OpenRouter" },
  { name: "GLM-4", role: "Agentic reasoning", stat: "OpenRouter" },
  { name: "Llama 3.3 70B", role: "Long-context agent", stat: "OpenRouter" },
  { name: "Nemotron 70B", role: "Instruction-tuned reasoning", stat: "OpenRouter" },
  { name: "Qwen2.5-72B", role: "Cortex LLM", stat: "Nebius" },
  { name: "Claude Sonnet 4.6", role: "Frontier VLM", stat: "Anthropic" },
  { name: "Llama Guard 3", role: "Safety moderation", stat: "Nebius" },
];

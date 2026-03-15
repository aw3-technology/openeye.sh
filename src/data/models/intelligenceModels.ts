import type { ModelGroup } from "./types";

export const intelligenceModelGroups: ModelGroup[] = [
  {
    category: "Vision-Language Models",
    color: "text-terminal-amber",
    heading: "Smart-layer reasoning.",
    models: [
      {
        name: "Qwen2.5-VL",
        creator: "Alibaba Qwen",
        role: "Primary VLM for reasoning",
        description:
          "Multimodal vision-language model powering the smart detection layer. Provides contextual scene understanding and hazard reasoning.",
        status: "integrated",
        performance: "Context-aware / 2-3s cycle",
        provider: "Nebius / OpenRouter",
      },
      {
        name: "InternVL 2.5",
        creator: "Shanghai AI Lab",
        role: "Alternative VLM",
        description:
          "Strong open-source multimodal model. Drop-in replacement for Qwen2.5-VL via model adapter.",
        status: "planned",
      },
      {
        name: "Claude Sonnet 4.6",
        creator: "Anthropic",
        role: "Frontier VLM",
        description:
          "Anthropic's frontier vision-language model with strong reasoning and safety alignment. Integrated as a first-class VLM and LLM provider.",
        status: "integrated",
        performance: "Low latency / safety-aligned",
        provider: "Anthropic",
      },
      {
        name: "Phi-3 Vision",
        creator: "Microsoft",
        role: "Edge VLM",
        description:
          "Compact multimodal model optimized for on-device inference. Perfect for local-only deployments without cloud access.",
        status: "planned",
      },
      {
        name: "Llama 3.2 Vision",
        creator: "Meta AI",
        role: "Multimodal VLM",
        description:
          "Open-weight multimodal model with on-device and server variants. Cost-effective vision-language reasoning available via OpenRouter.",
        status: "integrated",
        performance: "11B / 90B variants",
        provider: "OpenRouter",
      },
      {
        name: "Pixtral 12B",
        creator: "Mistral AI",
        role: "Natively multimodal",
        description:
          "Natively multimodal model with variable-resolution image encoding. Efficient vision understanding via OpenRouter.",
        status: "integrated",
        performance: "12B params / variable-res",
        provider: "OpenRouter",
      },
      {
        name: "DeepSeek-VL2",
        creator: "DeepSeek",
        role: "MoE vision-language",
        description:
          "Mixture-of-experts vision-language model with strong reasoning capabilities. Available via OpenRouter for complex scene analysis.",
        status: "integrated",
        performance: "MoE architecture",
        provider: "OpenRouter",
      },
      {
        name: "Kimi-K2.5",
        creator: "Moonshot AI",
        role: "Frontier open-source VLM",
        description:
          "State-of-the-art open-source vision-language model with strong reasoning and instruction following. Drop-in VLM swap via Nebius Token Factory.",
        status: "integrated",
        performance: "Frontier quality / open-source",
        provider: "Nebius",
      },
    ],
  },
  {
    category: "LLM Reasoning",
    color: "text-sky-400",
    heading: "Text reasoning and planning via Nebius Token Factory.",
    models: [
      {
        name: "Qwen2.5-72B",
        creator: "Alibaba Qwen",
        role: "Primary cortex LLM",
        description:
          "72B-parameter model for high-quality text reasoning, planning, and tool use. Powers the cortex decision layer.",
        status: "integrated",
        performance: "72B params",
        provider: "Nebius",
      },
      {
        name: "DeepSeek-V3",
        creator: "DeepSeek",
        role: "Alternative reasoning LLM",
        description:
          "Strong open-source MoE reasoning model with excellent code and math performance. Available as a cortex LLM alternative.",
        status: "integrated",
        performance: "High reasoning / code",
        provider: "Nebius",
      },
      {
        name: "Llama 3.1 70B",
        creator: "Meta AI",
        role: "Compact reasoning LLM",
        description:
          "Open-weight model with 128K context, balancing quality and speed. Good for latency-sensitive cortex deployments.",
        status: "integrated",
        performance: "70B / 128K context",
        provider: "Nebius",
      },
      {
        name: "Mixtral 8x22B",
        creator: "Mistral AI",
        role: "MoE reasoning LLM",
        description:
          "Mixture-of-experts model with broad general knowledge and efficient inference. Alternative cortex backbone.",
        status: "integrated",
        performance: "MoE / 65K context",
        provider: "Nebius",
      },
    ],
  },
  {
    category: "Safety & Moderation",
    color: "text-red-400",
    heading: "Content safety classification.",
    models: [
      {
        name: "Llama Guard 3",
        creator: "Meta AI",
        role: "Content moderation",
        description:
          "Purpose-built safety classifier that labels content as safe or unsafe across hazard categories. Used for real-time moderation of perception outputs.",
        status: "integrated",
        performance: "8B params / <100ms",
        provider: "Nebius",
      },
    ],
  },
  {
    category: "Embeddings",
    color: "text-teal-400",
    heading: "Vector embeddings for RAG and retrieval.",
    models: [
      {
        name: "Qwen2.5-Embedding",
        creator: "Alibaba Qwen",
        role: "Knowledge base embeddings",
        description:
          "High-dimensional embedding model producing 4096-dim vectors for semantic search. Powers the RAG knowledge base retrieval pipeline.",
        status: "integrated",
        performance: "4096-dim / 8B params",
        provider: "Nebius",
      },
    ],
  },
  {
    category: "Agentic Reasoning",
    color: "text-orange-400",
    heading: "Planning layer after perception.",
    models: [
      {
        name: "GLM-4",
        creator: "Zhipu AI",
        role: "Agent-optimized reasoning",
        description:
          "Agent-optimized language model with long context support. Designed for multi-step planning and decision-making after perception.",
        status: "integrated",
        performance: "128K context",
        provider: "OpenRouter",
      },
      {
        name: "Llama 3.3 70B",
        creator: "Meta AI",
        role: "Long-context agentic",
        description:
          "Open-weight model with 128K context. Excels at long-context reasoning and multi-step task planning for autonomous workflows.",
        status: "integrated",
        performance: "128K context / open-weight",
        provider: "OpenRouter",
      },
      {
        name: "Nemotron 70B",
        creator: "NVIDIA",
        role: "Instruction-tuned reasoning",
        description:
          "NVIDIA's instruction-tuned model optimized for agentic reasoning, tool use, and planning tasks.",
        status: "integrated",
        performance: "70B params / tool use",
        provider: "OpenRouter",
      },
    ],
  },
  {
    category: "Video Vision Models",
    color: "text-cyan-400",
    heading: "Multimodal video understanding via OpenRouter. Built-in on web, or bring your own API key.",
    models: [
      {
        name: "Gemini 2.0 Flash",
        creator: "Google",
        role: "Fast multimodal model",
        description:
          "Fast multimodal model with native vision and audio understanding. Strong at real-time perception and multi-step reasoning tasks.",
        status: "integrated",
        performance: "1M context / low latency",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 3.1 Pro Preview",
        creator: "Google",
        role: "Frontier video reasoning",
        description:
          "Google's frontier reasoning model with enhanced SWE performance, agentic reliability, and efficient token usage. 1M-token context with multimodal reasoning across text, image, video, audio, and code.",
        status: "integrated",
        performance: "1.05M context / $2 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 3.1 Pro Custom Tools",
        creator: "Google",
        role: "Tool-optimized video model",
        description:
          "Gemini 3.1 Pro variant that improves tool selection behavior for coding agents and multi-tool workflows. Prevents overuse of general tools when specialized functions are available.",
        status: "integrated",
        performance: "1.05M context / $2 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 3.1 Flash Lite Preview",
        creator: "Google",
        role: "High-efficiency video model",
        description:
          "Optimized for high-volume use cases. Outperforms Gemini 2.5 Flash Lite with improvements in audio, RAG, translation, data extraction, and code. Configurable thinking levels.",
        status: "integrated",
        performance: "1.05M context / $0.25 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 3 Flash Preview",
        creator: "Google",
        role: "Fast agentic video model",
        description:
          "High-speed thinking model for agentic workflows and coding assistance. Near-Pro reasoning with substantially lower latency. Configurable thinking levels.",
        status: "integrated",
        performance: "1.05M context / $0.50 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 3 Pro Preview",
        creator: "Google",
        role: "Flagship multimodal reasoning",
        description:
          "Google's flagship frontier model for high-precision multimodal reasoning. State-of-the-art on LMArena, GPQA Diamond, MathArena, MMMU-Pro, and Video-MMMU benchmarks.",
        status: "integrated",
        performance: "1.05M context / $2 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 2.5 Flash",
        creator: "Google",
        role: "Workhorse video model",
        description:
          "Google's state-of-the-art workhorse model with built-in thinking for advanced reasoning, coding, and scientific tasks. Configurable reasoning depth.",
        status: "integrated",
        performance: "1.05M context / $0.30 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 2.5 Flash Lite",
        creator: "Google",
        role: "Ultra-low-latency video",
        description:
          "Lightweight reasoning model optimized for ultra-low latency and cost efficiency. 50x cheaper than full Flash with optional thinking mode.",
        status: "integrated",
        performance: "1.05M context / $0.10 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 2.5 Pro",
        creator: "Google",
        role: "Advanced video reasoning",
        description:
          "Google's advanced reasoning model with thinking capabilities. First-place on LMArena with superior human-preference alignment across complex tasks.",
        status: "integrated",
        performance: "1.05M context / $1.25 input",
        provider: "OpenRouter",
      },
      {
        name: "Gemini 2.5 Flash Lite 09-2025",
        creator: "Google",
        role: "Legacy efficient video model",
        description:
          "September 2025 version of Flash Lite with ultra-low latency. Selectively enable thinking via Reasoning API for cost-performance trade-offs.",
        status: "integrated",
        performance: "1.05M context / $0.10 input",
        provider: "OpenRouter",
      },
    ],
  },
  {
    category: "Vision-Language-Action",
    color: "text-purple-400",
    heading: "From perception to action.",
    models: [
      {
        name: "SmolVLA",
        creator: "HuggingFace",
        role: "Robotic action generation",
        description:
          "Vision-language-action model that outputs robotic control vectors from visual observations. Powers autonomous manipulation tasks.",
        status: "integrated",
        performance: "Action vectors / real-time",
      },
    ],
  },
];

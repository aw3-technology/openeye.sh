export interface Model {
  name: string;
  creator: string;
  role: string;
  description: string;
  status: "integrated" | "planned";
  performance?: string;
  provider?: string;
}

export interface ModelGroup {
  category: string;
  color: string;
  heading: string;
  models: Model[];
}

export const modelGroups: ModelGroup[] = [
  {
    category: "Real-Time Detection",
    color: "text-terminal-green",
    heading: "Fast-layer detection models.",
    models: [
      {
        name: "YOLO26",
        creator: "Ultralytics",
        role: "Primary fast-layer detector",
        description:
          "Latest YOLO generation running at 30fps. Powers the safety-critical fast detection layer for instant human and object detection.",
        status: "integrated",
        performance: "30fps / <50ms latency",
      },
      {
        name: "RF-DETR",
        creator: "Roboflow",
        role: "Transformer-based detector",
        description:
          "Real-time detection transformer without NMS post-processing. High accuracy with end-to-end architecture.",
        status: "integrated",
        performance: "High accuracy / no NMS",
      },
      {
        name: "YOLOWorld",
        creator: "Tencent AILab",
        role: "Open-vocabulary detector",
        description:
          "Detect any object from a text prompt without retraining. Useful for custom workspace monitoring.",
        status: "planned",
      },
    ],
  },
  {
    category: "Segmentation",
    color: "text-blue-400",
    heading: "Pixel-perfect object boundaries.",
    models: [
      {
        name: "SAM 3",
        creator: "Meta AI",
        role: "Zero-shot segmentation",
        description:
          "Segment Anything Model for precise object boundaries. Used in scene graph construction and spatial reasoning.",
        status: "integrated",
        performance: "Zero-shot / any object",
      },
      {
        name: "Grounded-SAM",
        creator: "IDEA Research",
        role: "Text-prompted segmentation",
        description:
          "Combines Grounding DINO with SAM for language-guided segmentation. Detect and segment from natural language.",
        status: "planned",
      },
      {
        name: "FastSAM",
        creator: "CASIA-IVA",
        role: "Lightweight segmentation",
        description:
          "CNN-based SAM alternative running 50x faster. Ideal for edge devices and real-time segmentation needs.",
        status: "planned",
      },
    ],
  },
  {
    category: "Vision-Language Models",
    color: "text-terminal-amber",
    heading: "Smart-layer reasoning.",
    models: [
      {
        name: "Qwen3-VL",
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
          "GPT-4o-level open-source multimodal model. Drop-in replacement for Qwen3-VL via model adapter.",
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
        name: "Qwen3.5-9B",
        creator: "Qwen",
        role: "Multimodal VLM",
        description:
          "Newer multimodal Qwen model with 256K context window. Cost-effective vision-language reasoning at $0.05/$0.15 per million tokens.",
        status: "integrated",
        performance: "256K context / $0.05 input",
        provider: "OpenRouter",
      },
      {
        name: "Seed-2.0-Lite",
        creator: "ByteDance",
        role: "Low-latency multimodal",
        description:
          "Multimodal model optimized for low latency inference. 262K context with competitive vision understanding at $0.25/$2 per million tokens.",
        status: "integrated",
        performance: "262K context / low latency",
        provider: "OpenRouter",
      },
      {
        name: "GPT-5.4",
        creator: "OpenAI",
        role: "Premium multimodal",
        description:
          "OpenAI's premium multimodal model with 1.05M context window. Top-tier vision reasoning for complex scene understanding and analysis.",
        status: "integrated",
        performance: "1.05M context / $2.50 input",
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
        name: "Qwen3-235B",
        creator: "Alibaba Qwen",
        role: "Primary cortex LLM",
        description:
          "235B-parameter MoE model (22B active) for high-quality text reasoning, planning, and tool use. Powers the cortex decision layer.",
        status: "integrated",
        performance: "235B MoE / 22B active",
        provider: "Nebius",
      },
      {
        name: "DeepSeek-V3.2",
        creator: "DeepSeek",
        role: "Alternative reasoning LLM",
        description:
          "Strong open-source reasoning model with excellent code and math performance. Available as a cortex LLM alternative.",
        status: "integrated",
        performance: "High reasoning / code",
        provider: "Nebius",
      },
      {
        name: "Qwen3-Next-80B",
        creator: "Alibaba Qwen",
        role: "Compact reasoning LLM",
        description:
          "Smaller MoE variant (14B active) balancing quality and speed. Good for latency-sensitive cortex deployments.",
        status: "integrated",
        performance: "80B MoE / 14B active",
        provider: "Nebius",
      },
      {
        name: "GPT-OSS-120B",
        creator: "Marcus Aurelius",
        role: "Community reasoning LLM",
        description:
          "Community-built 120B-parameter open-source model with broad general knowledge. Alternative cortex backbone.",
        status: "integrated",
        performance: "120B params",
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
        name: "Qwen3-Embedding-8B",
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
        name: "GLM-5 Turbo",
        creator: "Z.ai",
        role: "Agent-optimized reasoning",
        description:
          "Agent-optimized language model with 203K context. Designed for multi-step planning and decision-making after perception at $0.96/$3.20 per million tokens.",
        status: "integrated",
        performance: "203K context / $0.96 input",
        provider: "OpenRouter",
      },
      {
        name: "Hunter Alpha",
        creator: "OpenRouter",
        role: "Long-context agentic",
        description:
          "Free agentic model with 1.05M context window. Excels at long-context reasoning and multi-step task planning for autonomous workflows.",
        status: "integrated",
        performance: "1.05M context / free tier",
        provider: "OpenRouter",
      },
      {
        name: "Nemotron 3 Super",
        creator: "NVIDIA",
        role: "Efficient MoE reasoning",
        description:
          "Free mixture-of-experts model with 262K context. Efficient agentic reasoning with NVIDIA's optimized architecture for planning tasks.",
        status: "integrated",
        performance: "262K context / free tier",
        provider: "OpenRouter",
      },
    ],
  },
  {
    category: "Detection Frameworks",
    color: "text-terminal-green",
    heading: "Open-vocabulary grounding.",
    models: [
      {
        name: "Grounding DINO 1.5",
        creator: "IDEA Research",
        role: "Open-set grounding",
        description:
          "Language-guided object detection for identifying objects by description. Powers natural language scene queries.",
        status: "integrated",
        performance: "Open-vocabulary / text-prompted",
      },
      {
        name: "OWLv2",
        creator: "Google Research",
        role: "Open-world detection",
        description:
          "Scaled open-world detection with self-training. Alternative grounding backbone for specific use cases.",
        status: "planned",
      },
    ],
  },
  {
    category: "Depth & 3D",
    color: "text-muted-foreground",
    heading: "Spatial understanding.",
    models: [
      {
        name: "Depth Anything V2",
        creator: "HKU / TikTok",
        role: "Monocular depth estimation",
        description:
          "Estimate depth from a single camera. Enables spatial reasoning and 3D scene understanding without stereo cameras.",
        status: "integrated",
        performance: "Real-time / single camera",
      },
      {
        name: "DUSt3R",
        creator: "Naver Labs",
        role: "3D reconstruction",
        description:
          "Dense 3D reconstruction from image pairs. Future support for full environment mapping.",
        status: "planned",
      },
    ],
  },
  {
    category: "Video Vision Models",
    color: "text-cyan-400",
    heading: "Multimodal video understanding via OpenRouter. Built-in on web, or bring your own API key.",
    models: [
      {
        name: "Healer Alpha",
        creator: "OpenRouter",
        role: "Omni-modal frontier model",
        description:
          "199B-param omni-modal model with vision, hearing, reasoning, and action capabilities. Natively perceives visual and audio inputs for complex multi-step tasks.",
        status: "integrated",
        performance: "262K context / free tier",
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

export interface ProductionModel {
  name: string;
  role: string;
  stat: string;
}

export const productionModels: ProductionModel[] = [
  { name: "YOLO26", role: "Fast detection", stat: "30fps" },
  { name: "SAM 2", role: "Segmentation", stat: "Zero-shot" },
  { name: "Qwen3-VL", role: "VLM reasoning", stat: "Nebius / OpenRouter" },
  { name: "Grounding DINO 1.5", role: "Open-set grounding", stat: "Text-prompted" },
  { name: "RF-DETR", role: "Detection transformer", stat: "No NMS" },
  { name: "SmolVLA", role: "Robot actions", stat: "Real-time" },
  { name: "Depth Anything V2", role: "Depth estimation", stat: "Monocular" },
  { name: "Qwen3.5-9B", role: "Multimodal VLM", stat: "OpenRouter" },
  { name: "Seed-2.0-Lite", role: "Low-latency VLM", stat: "OpenRouter" },
  { name: "GPT-5.4", role: "Premium multimodal", stat: "OpenRouter" },
  { name: "GLM-5 Turbo", role: "Agentic reasoning", stat: "OpenRouter" },
  { name: "Hunter Alpha", role: "Long-context agent", stat: "OpenRouter" },
  { name: "Nemotron 3 Super", role: "MoE reasoning", stat: "OpenRouter" },
  { name: "Qwen3-235B", role: "Cortex LLM", stat: "Nebius" },
  { name: "Claude Sonnet 4.6", role: "Frontier VLM", stat: "Anthropic" },
  { name: "Llama Guard 3", role: "Safety moderation", stat: "Nebius" },
];

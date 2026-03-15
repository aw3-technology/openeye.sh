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
        name: "YOLOv8",
        creator: "Ultralytics",
        role: "Primary fast-layer detector",
        description:
          "Real-time object detection with 80 COCO classes. Powers the safety-critical fast detection layer. Supports ONNX and TensorRT backends.",
        status: "integrated",
        performance: "Real-time / ONNX + TRT",
      },
      {
        name: "YOLO26",
        creator: "Ultralytics",
        role: "Next-gen fast-layer detector",
        description:
          "Latest generation YOLO model (YOLO11) optimized for speed. Smaller weights and faster inference than YOLOv8 with comparable accuracy.",
        status: "integrated",
        performance: "Real-time / 5 MB weights",
      },
      {
        name: "RF-DETR",
        creator: "Roboflow",
        role: "Transformer-based detector",
        description:
          "Real-time detection transformer without NMS post-processing. End-to-end architecture for high-accuracy detection.",
        status: "integrated",
        performance: "Real-time / no NMS",
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
        name: "SAM 2",
        creator: "Meta AI",
        role: "Zero-shot segmentation",
        description:
          "Segment Anything Model 2 for precise object boundaries. Automatic mask generation for any object in any image. Used in scene graph construction and spatial reasoning.",
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
          "CNN-based SAM alternative running significantly faster. Ideal for edge devices and real-time segmentation needs.",
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
        name: "Qwen2.5-VL",
        creator: "Alibaba Qwen",
        role: "VLM for reasoning",
        description:
          "Multimodal vision-language model for contextual scene understanding and hazard reasoning. Available via Nebius Token Factory and OpenRouter.",
        status: "integrated",
        provider: "Nebius / OpenRouter",
      },
      {
        name: "InternVL 2.5",
        creator: "Shanghai AI Lab",
        role: "Alternative VLM",
        description:
          "Open-source multimodal model with strong visual reasoning. Drop-in replacement via model adapter.",
        status: "planned",
      },
      {
        name: "Phi-3 Vision",
        creator: "Microsoft",
        role: "Edge VLM",
        description:
          "Compact multimodal model optimized for on-device inference. For local-only deployments without cloud access.",
        status: "planned",
      },
    ],
  },
  {
    category: "Detection Frameworks",
    color: "text-terminal-green",
    heading: "Open-vocabulary grounding.",
    models: [
      {
        name: "Grounding DINO",
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
          "Scaled open-world detection with self-training. Alternative grounding backbone.",
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
          "Dense 3D reconstruction from image pairs. For full environment mapping.",
        status: "planned",
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
          "Vision-language-action model that outputs robotic control vectors from visual observations. For autonomous manipulation tasks.",
        status: "integrated",
        performance: "Action vectors / CUDA + CPU",
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
  { name: "YOLOv8", role: "Fast detection", stat: "Integrated" },
  { name: "YOLO26", role: "Next-gen detection", stat: "Integrated" },
  { name: "RF-DETR", role: "Transformer detection", stat: "Integrated" },
  { name: "Grounding DINO", role: "Open-set grounding", stat: "Integrated" },
  { name: "Depth Anything V2", role: "Depth estimation", stat: "Integrated" },
  { name: "SAM 2", role: "Segmentation", stat: "Integrated" },
  { name: "SmolVLA", role: "Vision-language-action", stat: "Integrated" },
  { name: "Qwen2.5-VL", role: "VLM reasoning", stat: "Integrated" },
];

export interface BenchmarkRow {
  model: string;
  task: string;
  speed: string;
  accuracy: string;
  size: string;
  backend: string;
}

export const benchmarks: BenchmarkRow[] = [
  {
    model: "YOLO26",
    task: "Detection",
    speed: "~2 ms",
    accuracy: "53.1 mAP",
    size: "5 MB",
    backend: "ONNX / TRT",
  },
  {
    model: "YOLOv8n",
    task: "Detection",
    speed: "~3 ms",
    accuracy: "37.3 mAP",
    size: "6 MB",
    backend: "ONNX / TRT",
  },
  {
    model: "RF-DETR",
    task: "Detection",
    speed: "~6 ms",
    accuracy: "54.0 mAP",
    size: "39 MB",
    backend: "PyTorch",
  },
  {
    model: "Grounding DINO",
    task: "Grounding",
    speed: "~40 ms",
    accuracy: "Open-vocab",
    size: "694 MB",
    backend: "PyTorch",
  },
  {
    model: "SAM 2",
    task: "Segmentation",
    speed: "~50 ms",
    accuracy: "Zero-shot",
    size: "38 MB",
    backend: "PyTorch",
  },
  {
    model: "Depth Anything V2",
    task: "Depth",
    speed: "~15 ms",
    accuracy: "SOTA monocular",
    size: "97 MB",
    backend: "PyTorch",
  },
  {
    model: "SmolVLA",
    task: "VLA",
    speed: "~80 ms",
    accuracy: "Action vectors",
    size: "500 MB",
    backend: "CUDA / CPU",
  },
  {
    model: "Qwen2.5-VL",
    task: "VLM",
    speed: "~2 s",
    accuracy: "Contextual",
    size: "Cloud API",
    backend: "Nebius",
  },
];

export interface AdapterStep {
  step: string;
  title: string;
  description: string;
}

export const adapterSteps: AdapterStep[] = [
  {
    step: "01",
    title: "Register",
    description:
      "Every model implements a common Adapter interface — load, predict, and postprocess. Adding a new model means writing one file.",
  },
  {
    step: "02",
    title: "Resolve",
    description:
      "At runtime the adapter registry resolves a model name to the correct adapter. Weights are pulled from the model hub or local cache.",
  },
  {
    step: "03",
    title: "Run",
    description:
      "The pipeline calls adapter.predict() on every frame. Detection, segmentation, depth, and VLM adapters all share the same contract.",
  },
  {
    step: "04",
    title: "Swap",
    description:
      "Switch models with a CLI flag or API parameter. No code changes, no redeployment, no downtime. Hot-swap in production.",
  },
];

export interface ModelFaq {
  question: string;
  answer: string;
}

export const modelFaqs: ModelFaq[] = [
  {
    question: "How do I add a custom model?",
    answer:
      "Write a Python class that implements the ModelAdapter interface (load, predict, postprocess methods) and register it with the adapter registry. See the docs for a step-by-step guide.",
  },
  {
    question: "Can I use my own fine-tuned YOLO weights?",
    answer:
      "Yes. Point the --weights flag at your .pt or .onnx file. The YOLO adapter auto-detects the format and loads the correct backend.",
  },
  {
    question: "Which models run on CPU vs GPU?",
    answer:
      "All detection models (YOLO, RF-DETR) run on both CPU and CUDA. Grounding DINO and SAM 2 strongly prefer GPU. VLM inference (Qwen2.5-VL) runs via cloud API through Nebius Token Factory.",
  },
  {
    question: "What is the model adapter pattern?",
    answer:
      "It is a plugin architecture that lets you swap any vision model without touching application code. Each model implements a shared interface, so the pipeline treats all models the same way.",
  },
  {
    question: "Can I run multiple models simultaneously?",
    answer:
      "Yes. The dual-layer architecture runs a fast detector (YOLO) on every frame and a VLM on a slower cadence in parallel. You can also chain models — detection then segmentation, for example.",
  },
  {
    question: "How are planned models different from integrated ones?",
    answer:
      "Integrated models have full adapter implementations and are tested in the pipeline. Planned models have defined interfaces but are not yet production-ready. They are on the roadmap.",
  },
];

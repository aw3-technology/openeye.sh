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
        name: "RF-DETR",
        creator: "Roboflow",
        role: "Transformer-based detector",
        description:
          "Real-time detection transformer without NMS post-processing. End-to-end architecture for high-accuracy detection.",
        status: "planned",
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
        name: "SAM2",
        creator: "Meta AI",
        role: "Zero-shot segmentation",
        description:
          "Segment Anything Model 2 for precise object boundaries. Used in scene graph construction and spatial reasoning.",
        status: "planned",
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
          "Multimodal vision-language model for contextual scene understanding and hazard reasoning. Available via OpenRouter.",
        status: "planned",
        provider: "OpenRouter",
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
        status: "planned",
        performance: "Action vectors",
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
  { name: "Grounding DINO", role: "Open-set grounding", stat: "Integrated" },
  { name: "Depth Anything V2", role: "Depth estimation", stat: "Integrated" },
];

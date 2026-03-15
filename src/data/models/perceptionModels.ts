import type { ModelGroup } from "./types";

export const perceptionModelGroups: ModelGroup[] = [
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
        name: "SAM 2",
        creator: "Meta AI",
        role: "Zero-shot segmentation",
        description:
          "Segment Anything Model 2 for precise object boundaries. Used in scene graph construction and spatial reasoning.",
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
];

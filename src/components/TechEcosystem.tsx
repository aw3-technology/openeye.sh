import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EcosystemCard } from "@/components/EcosystemCard";

interface Project {
  name: string;
  creator: string;
  description: string;
  category: string;
  integrated?: boolean;
}

const categories = [
  "All",
  "Real-Time Detection",
  "Segmentation",
  "VLMs",
  "Detection Frameworks",
  "3D Vision",
  "Annotation & Labeling",
  "Deep Learning Frameworks",
] as const;

const projects: Project[] = [
  // Real-Time Detection
  { name: "YOLOv8", creator: "Ultralytics", description: "Real-time object detection — 80 COCO classes with ONNX and TensorRT support", category: "Real-Time Detection", integrated: true },
  { name: "RF-DETR", creator: "Roboflow", description: "Real-time detection transformer — end-to-end object detection without NMS", category: "Real-Time Detection" },
  { name: "YOLOWorld", creator: "Tencent AILab", description: "Open-vocabulary real-time detection with text prompts", category: "Real-Time Detection" },
  { name: "DAMO-YOLO", creator: "Alibaba DAMO", description: "Efficient YOLO variant with NAS-optimized architecture", category: "Real-Time Detection" },
  { name: "Gold-YOLO", creator: "Huazhong UST", description: "Gather-and-distribute mechanism for multi-scale feature fusion", category: "Real-Time Detection" },

  // Segmentation
  { name: "SAM2", creator: "Meta AI", description: "Segment Anything Model 2 — zero-shot segmentation for any object in any image", category: "Segmentation" },
  { name: "Grounded-SAM", creator: "IDEA Research", description: "Combines Grounding DINO with SAM for text-prompted segmentation", category: "Segmentation" },
  { name: "FastSAM", creator: "CASIA-IVA", description: "CNN-based SAM alternative running 50x faster", category: "Segmentation" },
  { name: "EfficientSAM", creator: "Meta AI", description: "Lightweight SAM with SAMI-distilled image encoders", category: "Segmentation" },
  { name: "Mask2Former", creator: "Meta AI", description: "Unified architecture for panoptic, instance, and semantic segmentation", category: "Segmentation" },

  // VLMs
  { name: "Qwen2.5-VL", creator: "Alibaba Qwen", description: "Multimodal vision-language model with native visual grounding", category: "VLMs" },
  { name: "LLaVA-NeXT", creator: "UW / Microsoft", description: "Improved visual instruction tuning with dynamic high-res support", category: "VLMs" },
  { name: "InternVL 2.5", creator: "Shanghai AI Lab", description: "Open-source multimodal model with strong visual reasoning", category: "VLMs" },
  { name: "CogVLM2", creator: "Tsinghua / Zhipu", description: "Visual expert architecture for deep image understanding", category: "VLMs" },
  { name: "Phi-3 Vision", creator: "Microsoft", description: "Compact multimodal model optimized for on-device inference", category: "VLMs" },

  // Detection Frameworks
  { name: "Grounding DINO", creator: "IDEA Research", description: "Open-set object detection with language-guided text prompts", category: "Detection Frameworks", integrated: true },
  { name: "OWLv2", creator: "Google Research", description: "Open-world object detection scaled with self-training", category: "Detection Frameworks" },
  { name: "GLIP", creator: "Microsoft", description: "Grounded language-image pre-training for phrase grounding", category: "Detection Frameworks" },
  { name: "Detectron2", creator: "Meta AI", description: "Modular object detection and segmentation platform", category: "Detection Frameworks" },
  { name: "MMDetection", creator: "OpenMMLab", description: "Comprehensive detection toolbox with 300+ models", category: "Detection Frameworks" },

  // 3D Vision
  { name: "Depth Anything", creator: "HKU / TikTok", description: "Monocular depth estimation at any resolution and scale", category: "3D Vision", integrated: true },
  { name: "DUSt3R", creator: "Naver Labs", description: "Dense unconstrained stereo 3D reconstruction from image pairs", category: "3D Vision" },
  { name: "NeRFStudio", creator: "Berkeley / Luma", description: "Modular framework for neural radiance field development", category: "3D Vision" },
  { name: "Open3D", creator: "Intel ISL", description: "Library for 3D data processing, reconstruction, and visualization", category: "3D Vision" },

  // Annotation & Labeling
  { name: "Label Studio", creator: "HumanSignal", description: "Multi-type data labeling and annotation platform", category: "Annotation & Labeling" },
  { name: "CVAT", creator: "Intel / OpenCV", description: "Computer vision annotation tool for image and video", category: "Annotation & Labeling" },
  { name: "Roboflow", creator: "Roboflow", description: "End-to-end dataset management, labeling, and deployment", category: "Annotation & Labeling" },
  { name: "FiftyOne", creator: "Voxel51", description: "Dataset curation, visualization, and model evaluation", category: "Annotation & Labeling" },

  // Deep Learning Frameworks
  { name: "PyTorch", creator: "Meta AI", description: "The dominant framework for deep learning research and production", category: "Deep Learning Frameworks" },
  { name: "ONNX Runtime", creator: "Microsoft", description: "Cross-platform inference engine for interoperable models", category: "Deep Learning Frameworks" },
  { name: "TensorRT", creator: "NVIDIA", description: "High-performance deep learning inference optimizer and runtime", category: "Deep Learning Frameworks" },
  { name: "Hugging Face Transformers", creator: "Hugging Face", description: "State-of-the-art model hub and inference library", category: "Deep Learning Frameworks" },
];

export function TechEcosystem() {
  const [active, setActive] = useState<string>("All");

  const filtered = active === "All" ? projects : projects.filter((p) => p.category === active);

  const grouped = active === "All"
    ? categories.slice(1).map((cat) => ({
        category: cat,
        items: projects.filter((p) => p.category === cat),
      }))
    : null;

  return (
    <section id="ecosystem" className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Technology Ecosystem
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Compatible with the open vision ecosystem.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            OpenEye is designed to work with open-source models and tools across computer vision. Swap models, combine pipelines, and extend with custom adapters.
          </p>
        </motion.div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide" role="tablist" aria-label="Filter by category">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              role="tab"
              aria-selected={active === cat}
              className={`font-mono text-xs whitespace-nowrap px-3 py-1.5 rounded-inner border transition-colors focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none ${
                active === cat
                  ? "bg-terminal-green/15 text-terminal-green border-terminal-green/30"
                  : "bg-terminal-bg text-muted-foreground border-foreground/5 hover:text-foreground hover:border-foreground/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Card grid */}
        <AnimatePresence mode="wait">
          {grouped ? (
            <motion.div
              key="all"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              {grouped.map((group) => (
                <div key={group.category}>
                  <div className="font-mono text-xs uppercase tracking-widest text-terminal-green/70 mb-3">
                    {group.category}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {group.items.map((project) => (
                      <EcosystemCard key={project.name} {...project} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {filtered.map((project) => (
                <EcosystemCard key={project.name} {...project} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stat bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.2, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-12 flex flex-wrap justify-center gap-8 font-mono text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-terminal-green" />
            {projects.filter(p => p.integrated).length} Integrated
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-terminal-green" />
            {categories.length - 1} Categories
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-terminal-green" />
            Model-Agnostic Architecture
          </div>
        </motion.div>
      </div>
    </section>
  );
}

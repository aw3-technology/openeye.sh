import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function ModelsSlide() {
  const models = [
    { name: "YOLOv8 / YOLO26", type: "Detection", desc: "Real-time object detection with quantized variants and MPS/CUDA support.", accent: "text-oe-green" },
    { name: "Depth Anything v2", type: "Depth", desc: "Monocular depth estimation for 3D position and floor-plane reasoning.", accent: "text-oe-blue" },
    { name: "Grounding DINO", type: "Open-Vocab", desc: "Text-prompted detection — find anything by natural language description.", accent: "text-primary" },
    { name: "SAM2", type: "Segmentation", desc: "Segment Anything Model for precise object masks and boundaries.", accent: "text-oe-red" },
    { name: "RF-DETR", type: "Transformer", desc: "NMS-free detection transformer — cleaner outputs, no post-processing.", accent: "text-terminal-amber" },
    { name: "SmolVLA", type: "VLA", desc: "Vision-Language-Action model for robotic control from visual input.", accent: "text-oe-green" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.03} />
      <GlowOrb color="hsl(var(--oe-blue))" size={400} x="80%" y="70%" blur={200} />
      <GlowOrb color="hsl(var(--primary))" size={300} x="5%" y="20%" blur={180} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Model Registry
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Plug in any model. <span className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent">Swap freely.</span>
        </motion.h2>
        <div className="grid grid-cols-3 gap-5 flex-1">
          {models.map((m, i) => (
            <motion.div
              key={m.name}
              className="bg-card/60 border border-border/50 rounded-xl p-7 flex flex-col backdrop-blur-sm relative overflow-hidden group hover:border-primary/30 transition-colors"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className={`font-mono text-sm uppercase tracking-widest ${m.accent} mb-3`}>{m.type}</div>
              <div className="text-[30px] font-semibold mb-3">{m.name}</div>
              <p className="text-lg text-muted-foreground leading-relaxed flex-1">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function PluginSlide() {
  const plugins = [
    { category: "Input Plugins", items: ["Perception Pipeline", "VLM + Local YOLO", "Video File", "Camera Stream"], accent: "text-oe-blue" },
    { category: "LLM Plugins", items: ["Nebius (Qwen 72B)", "OpenRouter", "OpenAI GPT-4o"], accent: "text-primary" },
    { category: "Action Plugins", items: ["Log to console", "Unitree G1 connector", "Safety search (Tavily)", "Custom handlers"], accent: "text-oe-red" },
    { category: "Adapters", items: ["yolov8 / yolo26", "depth_anything", "grounding_dino", "sam2 / rfdetr / smolvla"], accent: "text-oe-green" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--primary))" size={400} x="50%" y="50%" blur={250} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Extensibility
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Everything is a <span className="bg-gradient-to-r from-primary to-oe-green bg-clip-text text-transparent">plugin.</span>
        </motion.h2>
        <div className="grid grid-cols-4 gap-6 flex-1">
          {plugins.map((p, i) => (
            <motion.div
              key={p.category}
              className="flex flex-col"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <div className={`font-mono text-sm uppercase tracking-widest ${p.accent} mb-4`}>{p.category}</div>
              <div className="bg-card/60 border border-border/50 rounded-xl p-6 flex-1 space-y-4 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                {p.items.map((item, j) => (
                  <motion.div
                    key={item}
                    className="font-mono text-lg text-muted-foreground flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 + j * 0.05 }}
                  >
                    <span className="text-oe-green/60 mr-1">├─</span>{item}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-8 font-mono text-xl text-muted-foreground text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Discovery-based plugin pattern — drop a file, it's loaded automatically
        </motion.div>
      </div>
    </SlideLayout>
  );
}

import { motion } from "framer-motion";

import { SlideLayout, GridBackground } from "./components";

export function ArchitectureSlide() {
  const layers = [
    { label: "Input", items: ["USB Camera", "RTSP Stream", "Video File", "ROI Crop"], color: "bg-oe-blue", glow: "hsl(var(--oe-blue))" },
    { label: "Perception", items: ["Detection (YOLO/RF-DETR)", "Object Tracking", "Depth + 3D Position", "Floor Plane"], color: "bg-primary", glow: "hsl(var(--primary))" },
    { label: "Intelligence", items: ["Scene Graph", "VLM Reasoning", "Safety Guardian", "Governance"], color: "bg-oe-red", glow: "hsl(var(--oe-red))" },
    { label: "Output", items: ["REST API", "WebSocket", "Agentic WS", "Action Plan"], color: "bg-foreground", glow: "hsl(var(--foreground))" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.05} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Architecture
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Multi-stage perception pipeline
        </motion.h2>
        <div className="flex-1 flex items-center">
          <div className="w-full flex gap-4 items-stretch">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.label}
                className="flex-1 flex flex-col relative"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12 }}
              >
                {/* Connector arrow */}
                {i < layers.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-20 text-muted-foreground/50">
                    <motion.span
                      className="text-3xl block"
                      animate={{ x: [0, 6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    >
                      →
                    </motion.span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    className={`w-4 h-4 rotate-45 ${layer.color}`}
                    animate={{ rotate: [45, 135, 45] }}
                    transition={{ duration: 8, repeat: Infinity, delay: i * 0.5 }}
                  />
                  <span className="font-mono text-base uppercase tracking-widest text-foreground">
                    {layer.label}
                  </span>
                </div>
                <div className="bg-card/80 border border-border/60 rounded-xl p-5 flex-1 space-y-3 relative overflow-hidden backdrop-blur-sm">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${layer.color} opacity-40`} />
                  {layer.items.map((item, j) => (
                    <motion.div
                      key={item}
                      className="font-mono text-lg text-muted-foreground flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.12 + j * 0.05 }}
                    >
                      <span className="text-oe-green text-sm">▸</span> {item}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function GovernanceSlide() {
  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--oe-red))" size={400} x="70%" y="20%" blur={200} />
      <GlowOrb color="hsl(var(--oe-green))" size={350} x="20%" y="70%" blur={200} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Governance & MLOps
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Production-ready from <span className="bg-gradient-to-r from-oe-red to-oe-green bg-clip-text text-transparent">day one.</span>
        </motion.h2>
        <div className="grid grid-cols-2 gap-8 flex-1">
          {/* Governance */}
          <motion.div
            className="bg-card/60 border border-border/50 rounded-xl p-8 flex flex-col backdrop-blur-sm relative overflow-hidden"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oe-red/40 to-transparent" />
            <div className="font-mono text-sm uppercase tracking-widest text-oe-red mb-5">Policy Engine</div>
            <div className="text-[28px] font-semibold mb-6">Governance</div>
            <div className="space-y-4 font-mono text-lg text-muted-foreground flex-1">
              {["Zone policies (3D boundaries)", "Action filters (regex + speed limits)", "Object restrictions", "PII filters", "Interaction boundaries", "Rate limiters"].map((item, i) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                >
                  <span className="text-oe-red/60">├─</span> {item}
                </motion.div>
              ))}
            </div>
            <div className="mt-5 font-mono text-base bg-secondary/60 text-oe-green px-4 py-3 rounded-lg border border-border/40">
              $ openeye govern --presets robotics
            </div>
          </motion.div>

          {/* MLOps */}
          <motion.div
            className="bg-card/60 border border-border/50 rounded-xl p-8 flex flex-col backdrop-blur-sm relative overflow-hidden"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oe-green/40 to-transparent" />
            <div className="font-mono text-sm uppercase tracking-widest text-oe-green mb-5">Model Lifecycle</div>
            <div className="text-[28px] font-semibold mb-6">MLOps</div>
            <div className="space-y-4 font-mono text-lg text-muted-foreground flex-1">
              {["Promote: dev → staging → prod", "A/B testing with traffic splits", "Shadow mode (live comparison)", "Export: ONNX / TensorRT / CoreML", "INT8 quantization", "Lineage tracking & annotations"].map((item, i) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 + i * 0.06 }}
                >
                  <span className="text-oe-green/60">├─</span> {item}
                </motion.div>
              ))}
            </div>
            <div className="mt-5 font-mono text-base bg-secondary/60 text-oe-green px-4 py-3 rounded-lg border border-border/40">
              $ openeye mlops promote yolov8 --to production
            </div>
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );
}

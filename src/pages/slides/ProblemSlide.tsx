import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function ProblemSlide() {
  const items = ["Detection", "Depth", "Tracking", "Scene Graph", "Safety", "Planning"];
  return (
    <SlideLayout>
      <GridBackground opacity={0.03} />
      <GlowOrb color="hsl(var(--oe-red))" size={500} x="60%" y="10%" blur={200} />

      <div className="flex-1 flex px-20 py-20 relative z-10">
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            className="font-mono text-xl uppercase tracking-widest text-oe-red mb-6 flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="w-8 h-px bg-oe-red" />
            The Problem
          </motion.div>
          <motion.h2
            className="text-[72px] font-semibold font-display leading-[1.05] mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Robots can move.
            <br />
            They can't <span className="text-oe-red">see.</span>
          </motion.h2>
          <div className="space-y-6 text-[28px] text-muted-foreground leading-relaxed max-w-[900px]">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              Every robotics team rebuilds the same vision stack from scratch — YOLO wrappers, depth pipelines, safety logic, tracking.
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              There's no shared, pluggable perception layer for physical AI.
            </motion.p>
            <motion.p
              className="text-foreground font-medium text-[32px]"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              Until now.
            </motion.p>
          </div>
        </div>
        <div className="w-[500px] flex items-center justify-center">
          <div className="space-y-5 font-mono text-xl">
            {items.map((item, i) => (
              <motion.div
                key={item}
                className="flex items-center gap-4 bg-card/50 border border-border/50 rounded-lg px-5 py-3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <span className="text-oe-red text-2xl">✗</span>
                <span className={`flex-1 ${i < 4 ? "line-through text-muted-foreground/50" : "text-muted-foreground"}`}>{item}</span>
                <span className="text-muted-foreground/30 text-sm">rebuilt every time</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

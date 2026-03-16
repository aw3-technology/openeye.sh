import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function SolutionSlide() {
  const commands = [
    { cmd: "openeye pull yolov8", desc: "Pull open-source vision models from a registry — like Docker for CV.", icon: "↓" },
    { cmd: "openeye run yolov8 image.jpg", desc: "Run inference on images or live camera feeds with one command.", icon: "▶" },
    { cmd: "openeye watch --safety", desc: "Real-time workspace monitoring with automatic safety halt.", icon: "◉" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--primary))" size={500} x="50%" y="-10%" blur={250} />

      <div className="flex-1 flex flex-col justify-center px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-primary mb-6 flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="w-8 h-px bg-primary" />
          The Solution
        </motion.div>
        <motion.h2
          className="text-[72px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          One CLI. Any model.
          <br />
          Any camera. <span className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent">Any robot.</span>
        </motion.h2>
        <div className="grid grid-cols-3 gap-8">
          {commands.map((item, i) => (
            <motion.div
              key={item.cmd}
              className="bg-card/80 border border-border/60 rounded-xl p-8 space-y-5 backdrop-blur-sm relative overflow-hidden group"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.15 }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="font-mono text-5xl text-primary/30 mb-2">{item.icon}</div>
              <div className="font-mono text-xl text-oe-green px-4 py-3 rounded-lg bg-secondary/80 border border-border/40">
                $ {item.cmd}
              </div>
              <p className="text-[22px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

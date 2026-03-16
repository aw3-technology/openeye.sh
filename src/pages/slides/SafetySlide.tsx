import { motion } from "framer-motion";

import safetyWorkspace from "@/assets/demo/safety-workspace.jpg";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function SafetySlide() {
  const terminalLines = [
    { text: "$ openeye watch --safety", color: "text-oe-green" },
    { text: "[SAFETY] Monitoring workspace...", color: "text-muted-foreground" },
    { text: "[SAFETY] ✓ Scene stable — 4 objects", color: "text-oe-green" },
    { text: "[ANOMALY] ⚠ Human hand detected in zone A", color: "text-oe-red" },
    { text: "[SAFETY] → HALT signal sent to robot", color: "text-oe-red" },
    { text: "[AGENT] Paused. Awaiting clearance...", color: "text-muted-foreground" },
    { text: "[SAFETY] ✓ Zone A clear. Resuming.", color: "text-oe-green" },
  ];

  return (
    <SlideLayout>
      <GlowOrb color="hsl(var(--oe-red))" size={600} x="60%" y="20%" blur={250} />
      <GridBackground opacity={0.03} />

      <div className="flex-1 flex px-20 py-20 relative z-10">
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            className="font-mono text-xl uppercase tracking-widest text-oe-red mb-6 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="inline-block w-3 h-3 rounded-full bg-oe-red"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Safety Guardian
          </motion.div>
          <motion.h2
            className="text-[72px] font-semibold font-display leading-[1.05] mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Who watches
            <br />
            <span className="text-oe-red">the robots?</span>
          </motion.h2>
          <div className="space-y-7 text-[24px] text-muted-foreground leading-relaxed max-w-[750px]">
            {[
              { color: "bg-oe-green", label: "Fast Layer", desc: "YOLO runs every frame — pure geometry for real-time detection." },
              { color: "bg-primary", label: "Smart Layer", desc: "VLM analyzes periodically for contextual understanding." },
              { color: "bg-oe-red", label: "Halt Protocol", desc: "Danger detected → halt signal → resume when clear." },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="flex items-start gap-4 bg-card/40 border border-border/30 rounded-lg px-6 py-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
              >
                <span className={`mt-2 w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                <div><strong className="text-foreground">{item.label}:</strong> {item.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="w-[700px] flex flex-col items-center justify-center gap-6">
          {/* Camera feed preview */}
          <motion.div
            className="w-full aspect-video rounded-xl overflow-hidden border border-border/60 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <img src={safetyWorkspace} alt="Safety workspace" className="absolute inset-0 w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            <div className="absolute top-3 left-3 font-mono text-xs text-oe-green/70">OPENEYE GUARDIAN — LIVE</div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <motion.span className="w-1.5 h-1.5 rounded-full bg-oe-green" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="font-mono text-xs text-oe-green/70">MONITORING</span>
            </div>
          </motion.div>

          {/* Terminal output */}
          <motion.div
            className="w-full bg-card/80 border border-border/60 rounded-xl p-6 font-mono text-base leading-loose space-y-1 relative overflow-hidden backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {terminalLines.map((line, i) => (
              <motion.div
                key={i}
                className={line.color}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
              >
                {line.text}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );
}

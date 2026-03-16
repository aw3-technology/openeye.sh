import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function AgenticSlide() {
  const steps = [
    { label: "Detect", desc: "YOLO runs every frame — objects, positions, tracking IDs.", color: "bg-oe-green", icon: "◉" },
    { label: "Reason", desc: "VLM analyzes the scene every 3s — context, risks, intent.", color: "bg-primary", icon: "◈" },
    { label: "Plan", desc: "Action plan generated from scene graph + goal + memory.", color: "bg-oe-blue", icon: "▸" },
    { label: "Remember", desc: "Objects tracked across frames. Appearance/disappearance timeline.", color: "bg-oe-red", icon: "◆" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--primary))" size={500} x="60%" y="10%" blur={250} />
      <GlowOrb color="hsl(var(--oe-blue))" size={400} x="15%" y="60%" blur={200} />

      <div className="flex-1 flex px-20 py-20 relative z-10">
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            className="font-mono text-xl uppercase tracking-widest text-primary mb-6 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="inline-block w-3 h-3 rounded-full bg-primary"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            Agentic Perception
          </motion.div>
          <motion.h2
            className="text-[72px] font-semibold font-display leading-[1.05] mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Detect. Reason.
            <br />
            <span className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent">Plan. Remember.</span>
          </motion.h2>
          <div className="space-y-5 max-w-[750px]">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                className="flex items-start gap-4 bg-card/40 border border-border/30 rounded-lg px-6 py-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12 }}
              >
                <span className={`mt-1 w-2.5 h-2.5 rounded-full ${step.color} shrink-0`} />
                <div className="text-[24px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">{step.label}:</strong> {step.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="w-[600px] flex items-center justify-center">
          <motion.div
            className="w-full bg-card/80 border border-border/60 rounded-xl p-8 font-mono text-lg leading-loose space-y-2 relative overflow-hidden backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <motion.span
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-xs text-muted-foreground">AGENTIC</span>
            </div>
            {[
              { text: "WS /ws/agentic", color: "text-oe-green" },
              { text: '→ goal: "monitor workspace"', color: "text-muted-foreground" },
              { text: "[DETECT] 4 objects — person, table, mug, laptop", color: "text-oe-green" },
              { text: "[SCENE]  person seated at desk, mug on left", color: "text-oe-blue" },
              { text: "[VLM]    Person working, no hazards detected", color: "text-primary" },
              { text: "[PLAN]   Continue monitoring. No action needed.", color: "text-muted-foreground" },
              { text: "[MEMORY] 12 objects tracked · 47 frames", color: "text-oe-red" },
            ].map((line, i) => (
              <motion.div
                key={i}
                className={line.color}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12 }}
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

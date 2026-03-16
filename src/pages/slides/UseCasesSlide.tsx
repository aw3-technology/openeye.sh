import { motion } from "framer-motion";

import safetyWorkspace from "@/assets/demo/safety-workspace.jpg";
import sceneKitchen from "@/assets/demo/scene-kitchen.jpg";
import sceneWarehouse from "@/assets/demo/scene-warehouse.jpg";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function UseCasesSlide() {
  const cases = [
    {
      overline: "Robotics",
      overlineColor: "text-terminal-amber",
      title: "Perception layer for any robot.",
      desc: "Dual-layer perception — fast YOLO detection for real-time geometry and VLM reasoning for context-dependent understanding — so robots can see, reason, and act safely.",
      scenarios: ["Safety zone enforcement", "Human-robot coexistence", "Hazard identification", "Scene graph for planning"],
      cmd: "openeye watch --safety --danger-m 0.5",
      image: safetyWorkspace,
    },
    {
      overline: "App Debugging",
      overlineColor: "text-red-400",
      title: "See what your application sees.",
      desc: "Analyze screenshots and screen recordings to detect UI anomalies, verify layout correctness, and generate structured descriptions of what's on screen.",
      scenarios: ["Visual regression detection", "Layout validation", "VLM-powered UI analysis", "CI/CD integration"],
      cmd: "openeye run screenshot.png --format json",
      image: sceneKitchen,
    },
    {
      overline: "Desktop Agents",
      overlineColor: "text-blue-400",
      title: "Eyes for computer-use agents.",
      desc: "Convert screen captures into structured perception data — detected elements, spatial relationships, and scene descriptions — so agents can reason and plan.",
      scenarios: ["UI element detection", "Screen understanding", "Multi-window awareness", "REST API for agent loops"],
      cmd: "openeye serve yolov8 --port 8000",
      image: sceneWarehouse,
    },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.03} />
      <GlowOrb color="hsl(var(--oe-blue))" size={400} x="10%" y="70%" blur={200} />
      <GlowOrb color="hsl(var(--oe-red))" size={300} x="85%" y="15%" blur={180} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Use Cases
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Built for the <span className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent">physical world.</span>
        </motion.h2>
        <div className="grid grid-cols-3 gap-6 flex-1">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              className="bg-card/50 border border-border/40 rounded-xl p-8 flex flex-col backdrop-blur-sm relative overflow-hidden group"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.12 }}
            >
              <img src={c.image} alt={c.overline} className="absolute inset-0 w-full h-full object-cover opacity-15" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className={`font-mono text-sm uppercase tracking-widest ${c.overlineColor} mb-4 relative`}>{c.overline}</div>
              <div className="text-[28px] font-semibold mb-3 leading-tight relative">{c.title}</div>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6 relative">{c.desc}</p>
              <div className="space-y-2 mb-6 flex-1">
                {c.scenarios.map((s, j) => (
                  <motion.div
                    key={s}
                    className="font-mono text-base text-muted-foreground/80 flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.12 + j * 0.05 }}
                  >
                    <span className="text-oe-green/60">▸</span> {s}
                  </motion.div>
                ))}
              </div>
              <div className="font-mono text-base bg-secondary/60 text-oe-green px-4 py-3 rounded-lg border border-border/40">
                $ {c.cmd}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

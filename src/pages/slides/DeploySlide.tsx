import { motion } from "framer-motion";

import { SlideLayout, GridBackground, GlowOrb } from "./components";

export function DeploySlide() {
  const options = [
    {
      label: "Self-Hosted",
      desc: "All inference runs locally. No data leaves your premises. Deploy in air-gapped environments.",
      cmd: "pip install openeye-sh",
      icon: "🔒",
    },
    {
      label: "API Server",
      desc: "FastAPI server with REST, WebSocket, and Agentic endpoints. VLM reasoning, scene graphs, and a built-in dashboard.",
      cmd: "openeye serve yolov8 --port 8000",
      icon: "🌐",
    },
    {
      label: "Fleet Management",
      desc: "Register edge devices, deploy models with canary/rolling/blue-green strategies, OTA updates, and a device agent.",
      cmd: "openeye fleet deploy --strategy canary",
      icon: "📡",
    },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--oe-green))" size={400} x="80%" y="10%" blur={200} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Deployment
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Your hardware. Your data. <span className="bg-gradient-to-r from-primary to-oe-green bg-clip-text text-transparent">Your network.</span>
        </motion.h2>
        <div className="grid grid-cols-3 gap-8 flex-1">
          {options.map((item, i) => (
            <motion.div
              key={item.label}
              className="bg-card/60 border border-border/50 rounded-xl p-8 flex flex-col backdrop-blur-sm relative overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.12 }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="text-[40px] mb-3">{item.icon}</div>
              <div className="font-mono text-sm uppercase tracking-widest text-oe-green mb-4">{item.label}</div>
              <p className="text-[22px] text-muted-foreground leading-relaxed flex-1 mb-6">{item.desc}</p>
              <div className="font-mono text-base bg-secondary/60 text-oe-green px-4 py-3 rounded-lg border border-border/40">
                $ {item.cmd}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

import { motion } from "framer-motion";
import { TerminalBlock } from "@/components/TerminalBlock";

const heroTerminalLines = [
  { text: "$ pip install openeye-ai", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "$ openeye pull yolov8", color: "green" as const },
  { text: "[REGISTRY] Downloading ultralytics/yolov8n... 6.2MB", color: "muted" as const },
  { text: "[REGISTRY] ✓ yolov8 ready", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "$ openeye pull depth-anything", color: "green" as const },
  { text: "[REGISTRY] Downloading LiheYoung/depth-anything-v2... 98MB", color: "muted" as const },
  { text: "[REGISTRY] ✓ depth-anything ready", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "$ openeye watch --models yolov8,depth-anything", color: "green" as const },
  { text: "[CAMERA] Initialized: USB /dev/video0 @ 1920×1080", color: "muted" as const },
  { text: "[VISION] yolov8: 12 objects detected (30 FPS)", color: "green" as const },
  { text: "[DEPTH] depth-anything: dense map generated", color: "green" as const },
  { text: "[STREAM] Serving structured output → localhost:8420", color: "amber" as const },
];

function Diamond({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block w-2 h-2 rotate-45 ${className}`} />
  );
}

export function HeroSection() {
  return (
    <section className="pt-28 pb-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">
              <Diamond className="bg-oe-blue" />
              <Diamond className="bg-oe-red" />
              <Diamond className="bg-foreground" />
              <span className="ml-1">Open-Source Model Manager for Vision AI</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-display leading-[1.05] mb-6">
              Ollama for vision{" "}
              <span className="text-primary">and physical AI.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Pull any open-source vision model, run it on any camera, connect it to any robot. One CLI. No dependency hell.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="font-mono text-sm bg-card text-oe-green px-4 py-2.5 rounded-inner border border-foreground/[0.06]">
                pip install openeye-ai
              </div>
              <a
                href="https://github.com/openeye-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-inner hover:bg-primary/90 transition-colors active:scale-[0.98]"
              >
                View on GitHub →
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <TerminalBlock lines={heroTerminalLines} title="openeye — terminal" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

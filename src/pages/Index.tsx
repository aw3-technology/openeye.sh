import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { TerminalBlock } from "@/components/TerminalBlock";
import { VisionFrame } from "@/components/VisionFrame";
import { CommandCard } from "@/components/CommandCard";
import { SceneGraph } from "@/components/SceneGraph";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import logoVertical from "@/assets/openeye-logo-vertical.png";

const heroTerminalLines = [
  { text: "$ openeye watch --reason", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "[OPENEYE] Camera initialized...", color: "muted" as const },
  { text: "[VISION] Detected: apple (98%), knife (94%), cup (91%)", color: "green" as const },
  { text: "[SPATIAL] Hazard: knife is 2cm from hand_path", color: "amber" as const },
  { text: '[AGENT] Recommendation: Move knife to [Zone B] before proceeding.', color: "green" as const },
];

const planTerminalLines = [
  { text: '$ openeye plan "clear_workspace"', color: "green" as const },
  { text: "", color: "default" as const },
  { text: ">> Calculating affordances...", color: "muted" as const },
  { text: ">> Scene graph loaded: 4 objects, 1 hazard", color: "muted" as const },
  { text: "", color: "default" as const },
  { text: "[PLAN] Step 1: Move knife_01 → safe_zone_b", color: "green" as const },
  { text: "[PLAN] Step 2: Move book_01 → shelf_area", color: "green" as const },
  { text: "[PLAN] Step 3: Center cup_01 on workspace", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "[EXEC] Sending to robot adapter (solo-cli)...", color: "amber" as const },
  { text: "[DONE] Workspace cleared. 3 actions executed.", color: "green" as const },
];

const commands = [
  { label: "Detect", command: "openeye detect image.jpg", description: "Run object detection on any image or frame. Returns structured JSON with objects, locations, and confidence scores." },
  { label: "Scene", command: "openeye scene image.jpg", description: "Generate a full scene description with spatial relationships, hazard detection, and environment summary." },
  { label: "Watch", command: "openeye watch --reason", description: "Continuous perception mode. Live camera feed with real-time detection, reasoning, and hazard alerts." },
  { label: "Plan", command: 'openeye plan "clear desk"', description: "Given a natural language goal, generate a structured action plan using scene context and LLM reasoning." },
  { label: "Memory", command: "openeye recall kitchen", description: "Retrieve persistent environment memory. OpenEye remembers layouts, object positions, and learned patterns." },
  { label: "Stream", command: "openeye stream --grpc", description: "Stream structured perception data over gRPC or REST. Plug into any agent, robot, or downstream system." },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-[15vh] px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">
                Open-Source Perception Engine
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-display leading-[1.05] mb-6">
                Open-source eyes for the agent era.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                A CLI-first perception engine that turns raw video into structured world models for robots and autonomous agents.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-4 py-2.5 rounded-inner border border-foreground/5">
                  pip install openeye-ai
                </div>
                <a
                  href="https://github.com/openeye-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm bg-foreground text-background px-4 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
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

      {/* Vision Demo */}
      <section id="demo" className="py-[15vh] px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Perception Layer
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            See what the machine sees.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl">
            Real-time object detection with spatial reasoning, hazard classification, and agent-ready structured outputs.
          </p>

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <VisionFrame />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <SceneGraph />
            </div>
          </div>
        </div>
      </section>

      {/* The Perception Loop */}
      <section className="py-[15vh] px-4 bg-card">
        <div className="container max-w-6xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Autonomous Reasoning
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            From perception to action.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl">
            OpenEye doesn't just detect — it reasons about the scene and generates structured action plans for robots and agents.
          </p>

          <div className="max-w-2xl mx-auto">
            <TerminalBlock lines={planTerminalLines} title="openeye — planner" />
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-[15vh] px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Architecture
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
                Six layers. One pipeline.
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                Camera feed → Vision → Scene Understanding → LLM Reasoning → Action Planning → Robot Execution. Modular, swappable, open.
              </p>
              <div className="space-y-3 font-mono text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Hardware-agnostic: USB, RTSP, video files
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Model-agnostic: YOLO, CLIP, LLaVA, SAM
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Adapter-ready: Solo CLI, OpenClaw, ROS
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-amber" />
                  REST + gRPC endpoints for any downstream consumer
                </div>
              </div>
            </div>
            <ArchitectureDiagram />
          </div>
        </div>
      </section>

      {/* CLI Commands */}
      <section id="cli" className="py-[15vh] px-4 bg-card">
        <div className="container max-w-6xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            CLI Reference
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Plug-and-play CLI.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl">
            Every capability accessible from the command line. Like ffmpeg for machine perception.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {commands.map((cmd) => (
              <CommandCard key={cmd.label} {...cmd} />
            ))}
          </div>
        </div>
      </section>

      {/* Built With */}
      <section className="py-[15vh] px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Built With
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
            Open infrastructure. Open models.
          </h2>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 font-mono text-sm text-muted-foreground">
            {["Nebius Token Factory", "OpenRouter", "OpenClaw", "Hugging Face", "LangChain", "Solo CLI", "YOLOv8", "GroundingDINO"].map((tool) => (
              <motion.span
                key={tool}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="px-4 py-2 border border-foreground/[0.06] rounded-inner"
              >
                {tool}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[15vh] px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto text-center">
          <img src={logoVertical} alt="OpenEye" className="h-24 mx-auto mb-8" />
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            The perception layer is open.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Give your robots and agents the ability to see, understand, and act. Start building with OpenEye today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-4 py-2.5 rounded-inner border border-foreground/5">
              pip install openeye-ai
            </div>
            <a
              href="https://github.com/openeye-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm bg-foreground text-background px-4 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
            >
              Star on GitHub →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs text-muted-foreground">
            © 2026 OpenEye. Apache 2.0 License.
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-muted-foreground">
            <a href="https://github.com/openeye-ai" className="hover:text-foreground transition-colors">GitHub</a>
            <span>openeye.sh</span>
            <span>Nebius.Build Hackathon — SF 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

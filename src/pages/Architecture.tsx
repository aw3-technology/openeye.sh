import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface PipelineLayer {
  overline: string;
  overlineColor: string;
  title: string;
  description: string;
  terminalCommand: string;
  details: string[];
}

const pipelineLayers: PipelineLayer[] = [
  {
    overline: "Layer 1 — Camera Feed",
    overlineColor: "text-muted-foreground",
    title: "Any camera. Any format.",
    description:
      "OpenEye ingests video from USB cameras, RTSP network streams, and video files. Hardware-agnostic input layer with automatic format detection and frame extraction.",
    terminalCommand: "$ openeye watch --source rtsp://192.168.1.10:554/stream",
    details: [
      "USB webcams, industrial cameras, depth sensors",
      "RTSP, RTMP, HTTP-FLV network streams",
      "MP4, AVI, MKV video files",
      "Multi-camera support with frame synchronization",
    ],
  },
  {
    overline: "Layer 2 — Vision Engine",
    overlineColor: "text-terminal-green",
    title: "YOLO26 runs every frame.",
    description:
      "The fast detection layer processes every frame at 30fps using YOLO26. Model adapters let you swap to any supported detector without code changes. This is the safety-critical path — pure geometry, no LLM latency.",
    terminalCommand: "$ openeye detect image.jpg --model yolo26 --conf 0.4",
    details: [
      "YOLO26 as default fast-layer detector",
      "Model adapter pattern for hot-swapping",
      "Grounding DINO 1.5 for open-vocabulary queries",
      "SAM 3 for pixel-precise segmentation",
    ],
  },
  {
    overline: "Layer 3 — Scene Understanding",
    overlineColor: "text-terminal-green",
    title: "Objects become a world model.",
    description:
      "Raw detections are composed into a structured scene graph with spatial relationships, hazard classifications, and environment context. This is the representation that downstream systems consume.",
    terminalCommand: "$ openeye scene image.jpg --format json",
    details: [
      "Scene graph with typed objects and positions",
      "Spatial relationships (on, near, inside, above)",
      "Hazard classification (sharp, hot, unstable, blocking)",
      "Environment context and zone mapping",
    ],
  },
  {
    overline: "Layer 4 — LLM Reasoning",
    overlineColor: "text-terminal-amber",
    title: "The smart layer thinks.",
    description:
      "Every 2-3 seconds, a VLM analyzes the scene for context-dependent risks that geometry alone can't catch. Powered by Qwen3-VL via Nebius Token Factory for fast, affordable inference.",
    terminalCommand: "$ openeye watch --reason --vlm qwen3-vl",
    details: [
      "Qwen3-VL for multimodal scene reasoning",
      "Nebius Token Factory for hosted inference",
      "OpenRouter fallback for model flexibility",
      "Catches context-dependent risks (knife near edge, unstable stack)",
    ],
  },
  {
    overline: "Layer 5 — Action Planner",
    overlineColor: "text-muted-foreground",
    title: "Goals become action plans.",
    description:
      "Given a natural language goal and the current scene graph, the planner generates structured multi-step action plans with safety constraints. Each step is grounded in what OpenEye actually sees.",
    terminalCommand: '$ openeye plan "clear the workspace" --steps',
    details: [
      "Natural language goal decomposition",
      "Plans grounded in real-time scene state",
      "Safety constraints on every action step",
      "Affordance-aware manipulation planning",
    ],
  },
  {
    overline: "Layer 6 — Robot Adapter",
    overlineColor: "text-terminal-green",
    title: "Plans become robot actions.",
    description:
      "The adapter layer translates action plans into robot-specific commands. Support for Solo CLI, OpenClaw, and ROS integration. Halt signals bypass the full pipeline for sub-100ms emergency stops.",
    terminalCommand: "$ openeye exec --adapter solo-cli --plan plan.json",
    details: [
      "Solo CLI for direct servo control",
      "OpenClaw for dexterous manipulation",
      "ROS 2 integration (coming soon)",
      "Sub-100ms halt signal path",
    ],
  },
];

export default function Architecture() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Architecture | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Architecture
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              Six layers. One pipeline.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Camera feed to robot action in a single, modular pipeline. Every
              layer is swappable, every interface is open, and safety is built
              into the architecture — not bolted on.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pipeline Overview */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="grid lg:grid-cols-2 gap-16 items-start"
          >
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
                Pipeline Overview
              </div>
              <h2 className="text-3xl font-semibold font-display mb-4">
                From pixels to actions.
              </h2>
              <p className="text-muted-foreground mb-8">
                Every frame flows through six layers: input, detection, scene
                understanding, reasoning, planning, and execution. Each layer
                has a clean interface so you can swap any component.
              </p>
              <div className="space-y-3 font-mono text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Hardware-agnostic: USB, RTSP, video files
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Model-agnostic: swap any detection or VLM
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-green" />
                  Adapter-ready: Solo CLI, OpenClaw, ROS
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-terminal-amber" />
                  REST + gRPC endpoints for any consumer
                </div>
              </div>
            </div>
            <ArchitectureDiagram />
          </motion.div>
        </div>
      </section>

      {/* Pipeline Layer Deep Dives */}
      {pipelineLayers.map((layer, i) => (
        <section
          key={layer.overline}
          className={`py-[12vh] px-4 ${i % 2 === 0 ? "bg-card" : ""}`}
        >
          <div className="container max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease }}
            >
              <div
                className={`font-mono text-xs uppercase tracking-widest ${layer.overlineColor} mb-4`}
              >
                {layer.overline}
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
                {layer.title}
              </h2>
              <p className="text-muted-foreground mb-4 max-w-2xl">
                {layer.description}
              </p>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border inline-block mb-8">
                {layer.terminalCommand}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.1, ease }}
              className="grid sm:grid-cols-2 gap-4"
            >
              {layer.details.map((detail, j) => (
                <div
                  key={j}
                  className="flex items-start gap-3 p-4 border border-foreground/[0.06] rounded-outer bg-foreground/[0.02]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {detail}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      ))}

      {/* Safety Architecture */}
      <section className="py-[12vh] px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-red mb-4">
              Safety Architecture
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Dual-layer safety by design.
            </h2>
            <p className="text-muted-foreground mb-12 max-w-2xl">
              Safety isn't a feature — it's the architecture. Two independent
              detection paths run in parallel, each optimized for different
              threat categories.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05, ease }}
              className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
            >
              <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
                Fast Layer
              </div>
              <h3 className="text-xl font-semibold font-display mb-3">
                Geometry-based detection
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                YOLO26 runs every frame at 30fps. Pure geometric checks — is a
                hand inside the workspace polygon? Sub-100ms halt signal. No
                LLM latency, no network dependency.
              </p>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                  30fps continuous detection
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                  Sub-100ms halt latency
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                  Works fully offline
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.1, ease }}
              className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
            >
              <div className="font-mono text-xs uppercase tracking-widest text-terminal-amber mb-4">
                Smart Layer
              </div>
              <h3 className="text-xl font-semibold font-display mb-3">
                Context-aware reasoning
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                VLM analyzes the scene every 2-3 seconds for risks that geometry
                alone can't catch. A knife that wasn't there before, an unstable
                stack, context-dependent hazards.
              </p>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                  2-3 second analysis cycle
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                  Context-dependent risk detection
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                  Powered by Nebius Token Factory
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[12vh] px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Explore the full pipeline.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Read the documentation for implementation details, API references,
              and integration guides.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/docs"
                className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
              >
                Read the Docs
              </Link>
              <Link
                to="/models"
                className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98]"
              >
                View Models
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

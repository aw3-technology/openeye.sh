import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
  Grid3X3,
} from "lucide-react";

import logoHorizontal from "@/assets/openeye-logo-horizontal.png";
import logoHorizontalDark from "@/assets/openeye-logo-horizontal-dark.png";
import logoVertical from "@/assets/openeye-logo-vertical.png";
import logoVerticalDark from "@/assets/openeye-logo-vertical-dark.png";

// ─── Slide Data ───────────────────────────────────────────────────────────

interface SlideData {
  id: string;
  content: React.ReactNode;
}

// ─── Visual Components ────────────────────────────────────────────────────

function GridBackground({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground) / 0.15) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground) / 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

function GlowOrb({ color, size, x, y, blur = 200 }: { color: string; size: number; x: string; y: string; blur?: number }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: color,
        filter: `blur(${blur}px)`,
        opacity: 0.3,
      }}
    />
  );
}

function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

function PulsingDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.span
      className={`inline-block w-3 h-3 rounded-full ${color}`}
      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity, delay }}
    />
  );
}

function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="tabular-nums"
    >
      {value}{suffix}
    </motion.span>
  );
}

// ─── ScaledSlide ──────────────────────────────────────────────────────────

function ScaledSlide({
  children,
  containerRef,
}: {
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
}) {
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef?.current ?? wrapperRef.current?.parentElement;
    if (!container) return;

    const onResize = () => {
      const rect = container.getBoundingClientRect();
      const s = Math.min(rect.width / 1920, rect.height / 1080);
      setScale(s);
    };

    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute slide-content"
        style={{
          width: 1920,
          height: 1080,
          left: "50%",
          top: "50%",
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Individual Slide Components ──────────────────────────────────────────

function SlideLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full h-full bg-background text-foreground flex flex-col overflow-hidden relative ${className}`}
      style={{ width: 1920, height: 1080 }}
    >
      {children}
    </div>
  );
}

function LogoMark() {
  return (
    <>
      <img src={logoHorizontalDark} alt="OpenEye" className="h-10 logo-dark" />
      <img src={logoHorizontal} alt="OpenEye" className="h-10 logo-light" />
    </>
  );
}

function Diamond({ className = "" }: { className?: string }) {
  return <span className={`inline-block w-4 h-4 rotate-45 ${className}`} />;
}

function SlideNumber({ n, total }: { n: number; total: number }) {
  return (
    <div className="absolute bottom-12 right-16 font-mono text-base text-muted-foreground tabular-nums">
      {n} / {total}
    </div>
  );
}

// ─── Title Slide ──────────────────────────────────────────────────────────

function TitleSlide() {
  return (
    <SlideLayout>
      <GridBackground opacity={0.06} />
      <GlowOrb color="hsl(var(--oe-blue))" size={600} x="10%" y="-20%" blur={250} />
      <GlowOrb color="hsl(var(--oe-red))" size={400} x="70%" y="60%" blur={200} />
      <ScanLine />

      <div className="flex-1 flex flex-col items-center justify-center px-20 relative z-10">
        <motion.div
          className="flex items-center gap-5 mb-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <PulsingDot color="bg-oe-blue" delay={0} />
          <PulsingDot color="bg-oe-red" delay={0.3} />
          <PulsingDot color="bg-foreground" delay={0.6} />
        </motion.div>
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <img src={logoVerticalDark} alt="OpenEye" className="h-40 logo-dark" />
          <img src={logoVertical} alt="OpenEye" className="h-40 logo-light" />
        </motion.div>
        <motion.h1
          className="text-[96px] font-semibold font-display leading-[1] text-center tracking-tight mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Open-source eyes for
          <br />
          <span
            className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent"
          >
            the agent era.
          </span>
        </motion.h1>
        <motion.p
          className="text-[32px] text-muted-foreground text-center max-w-[1200px] leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          A perception engine that turns raw video into structured world models
          for robots and autonomous agents.
        </motion.p>
      </div>
      <motion.div
        className="pb-12 text-center font-mono text-lg text-muted-foreground relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        github.com/openeye-ai &nbsp;·&nbsp; Apache 2.0
      </motion.div>
    </SlideLayout>
  );
}

// ─── Problem Slide ────────────────────────────────────────────────────────

function ProblemSlide() {
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

// ─── Solution Slide ───────────────────────────────────────────────────────

function SolutionSlide() {
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

// ─── Architecture Slide ───────────────────────────────────────────────────

function ArchitectureSlide() {
  const layers = [
    { label: "Input", items: ["USB Camera", "RTSP Stream", "Video File", "Image"], color: "bg-oe-blue", glow: "hsl(var(--oe-blue))" },
    { label: "Perception", items: ["Detection (YOLO)", "Depth Estimation", "Object Tracking", "3D Position"], color: "bg-primary", glow: "hsl(var(--primary))" },
    { label: "Intelligence", items: ["Scene Graph", "Safety Eval", "Change Detection", "Action Suggest"], color: "bg-oe-red", glow: "hsl(var(--oe-red))" },
    { label: "Output", items: ["REST API", "WebSocket", "gRPC", "Event Bus"], color: "bg-foreground", glow: "hsl(var(--foreground))" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.05} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Architecture
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Multi-stage perception pipeline
        </motion.h2>
        <div className="flex-1 flex items-center">
          <div className="w-full flex gap-4 items-stretch">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.label}
                className="flex-1 flex flex-col relative"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12 }}
              >
                {/* Connector arrow */}
                {i < layers.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-20 text-muted-foreground/50">
                    <motion.span
                      className="text-3xl block"
                      animate={{ x: [0, 6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    >
                      →
                    </motion.span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    className={`w-4 h-4 rotate-45 ${layer.color}`}
                    animate={{ rotate: [45, 135, 45] }}
                    transition={{ duration: 8, repeat: Infinity, delay: i * 0.5 }}
                  />
                  <span className="font-mono text-base uppercase tracking-widest text-foreground">
                    {layer.label}
                  </span>
                </div>
                <div className="bg-card/80 border border-border/60 rounded-xl p-5 flex-1 space-y-3 relative overflow-hidden backdrop-blur-sm">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${layer.color} opacity-40`} />
                  {layer.items.map((item, j) => (
                    <motion.div
                      key={item}
                      className="font-mono text-lg text-muted-foreground flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.12 + j * 0.05 }}
                    >
                      <span className="text-oe-green text-sm">▸</span> {item}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Models Slide ─────────────────────────────────────────────────────────

function ModelsSlide() {
  const models = [
    { name: "YOLOv8", type: "Detection", desc: "Real-time object detection, multiple variants (nano to xlarge)", accent: "text-oe-green" },
    { name: "Depth Anything v2", type: "Depth", desc: "Monocular depth estimation for 3D spatial reasoning", accent: "text-oe-blue" },
    { name: "Grounding DINO", type: "Open-Vocab", desc: "Text-prompted detection — find anything by description", accent: "text-primary" },
    { name: "SAM2", type: "Segmentation", desc: "Segment Anything Model for precise object masks", accent: "text-oe-red" },
    { name: "ONNX Runtime", type: "Runtime", desc: "Cross-platform inference with hardware acceleration", accent: "text-terminal-amber" },
    { name: "TensorRT", type: "Runtime", desc: "NVIDIA-optimized inference for edge deployment", accent: "text-oe-green" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.03} />
      <GlowOrb color="hsl(var(--oe-blue))" size={400} x="80%" y="70%" blur={200} />
      <GlowOrb color="hsl(var(--primary))" size={300} x="5%" y="20%" blur={180} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Model Registry
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Plug in any model. <span className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent">Swap freely.</span>
        </motion.h2>
        <div className="grid grid-cols-3 gap-5 flex-1">
          {models.map((m, i) => (
            <motion.div
              key={m.name}
              className="bg-card/60 border border-border/50 rounded-xl p-7 flex flex-col backdrop-blur-sm relative overflow-hidden group hover:border-primary/30 transition-colors"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className={`font-mono text-sm uppercase tracking-widest ${m.accent} mb-3`}>{m.type}</div>
              <div className="text-[30px] font-semibold mb-3">{m.name}</div>
              <p className="text-lg text-muted-foreground leading-relaxed flex-1">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Safety Slide ─────────────────────────────────────────────────────────

function SafetySlide() {
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
        <div className="w-[700px] flex items-center justify-center">
          <motion.div
            className="w-full bg-card/80 border border-border/60 rounded-xl p-8 font-mono text-lg leading-loose space-y-1.5 relative overflow-hidden backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Blinking status light */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <motion.span
                className="w-2 h-2 rounded-full bg-oe-green"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-xs text-muted-foreground">LIVE</span>
            </div>

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

// ─── Plugin Architecture Slide ────────────────────────────────────────────

function PluginSlide() {
  const plugins = [
    { category: "Input Plugins", items: ["VLM (OpenAI, Gemini)", "Local YOLO", "Video File", "Perception Pipeline"], accent: "text-oe-blue" },
    { category: "LLM Plugins", items: ["OpenAI GPT-4o", "Nebius (Qwen, Llama)", "OpenRouter (free)"], accent: "text-primary" },
    { category: "Action Plugins", items: ["Log to console", "Robot connectors", "Custom handlers"], accent: "text-oe-red" },
    { category: "Adapters", items: ["yolov8", "depth_anything", "grounding_dino", "ONNX / TensorRT"], accent: "text-oe-green" },
  ];

  return (
    <SlideLayout>
      <GridBackground opacity={0.04} />
      <GlowOrb color="hsl(var(--primary))" size={400} x="50%" y="50%" blur={250} />

      <div className="flex-1 flex flex-col px-20 py-20 relative z-10">
        <motion.div
          className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="w-8 h-px bg-muted-foreground" />
          Extensibility
        </motion.div>
        <motion.h2
          className="text-[60px] font-semibold font-display leading-[1.05] mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Everything is a <span className="bg-gradient-to-r from-primary to-oe-green bg-clip-text text-transparent">plugin.</span>
        </motion.h2>
        <div className="grid grid-cols-4 gap-6 flex-1">
          {plugins.map((p, i) => (
            <motion.div
              key={p.category}
              className="flex flex-col"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <div className={`font-mono text-sm uppercase tracking-widest ${p.accent} mb-4`}>{p.category}</div>
              <div className="bg-card/60 border border-border/50 rounded-xl p-6 flex-1 space-y-4 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                {p.items.map((item, j) => (
                  <motion.div
                    key={item}
                    className="font-mono text-lg text-muted-foreground flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 + j * 0.05 }}
                  >
                    <span className="text-oe-green/60 mr-1">├─</span>{item}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-8 font-mono text-xl text-muted-foreground text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Discovery-based plugin pattern — drop a file, it's loaded automatically
        </motion.div>
      </div>
    </SlideLayout>
  );
}

// ─── Deployment Slide ─────────────────────────────────────────────────────

function DeploySlide() {
  const options = [
    {
      label: "Self-Hosted",
      desc: "All inference runs locally. No data leaves your premises. Deploy in air-gapped environments.",
      cmd: "pip install openeye-ai",
      icon: "🔒",
    },
    {
      label: "API Server",
      desc: "FastAPI server with REST + WebSocket. Send images, get structured JSON. Built-in dashboard.",
      cmd: "openeye serve yolov8 --port 8000",
      icon: "🌐",
    },
    {
      label: "Fleet Management",
      desc: "Register edge devices, deploy models, canary rollouts, rolling updates from the CLI.",
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

// ─── Use Cases Slide ──────────────────────────────────────────────────────

function UseCasesSlide() {
  const cases = [
    { icon: "🤖", title: "Robot Safety Monitor", desc: "Real-time workspace monitoring with automatic halt on human intrusion." },
    { icon: "🏭", title: "Industrial QA", desc: "Detect defects, track assembly progress, ensure quality standards." },
    { icon: "🏠", title: "Smart Home Robotics", desc: "Help domestic robots understand and navigate home environments." },
    { icon: "🌾", title: "Agriculture", desc: "Crop monitoring, livestock tracking, autonomous harvesting guidance." },
    { icon: "🔬", title: "Research & Education", desc: "Rapid prototyping for vision-based robotics research." },
    { icon: "🏗️", title: "Construction Safety", desc: "PPE detection, zone monitoring, hazard identification on job sites." },
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
        <div className="grid grid-cols-3 gap-5 flex-1">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              className="bg-card/50 border border-border/40 rounded-xl p-7 flex flex-col backdrop-blur-sm relative overflow-hidden group"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-[44px] mb-3">{c.icon}</div>
              <div className="text-[26px] font-semibold mb-2">{c.title}</div>
              <p className="text-lg text-muted-foreground leading-relaxed flex-1">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── CTA Slide ────────────────────────────────────────────────────────────

function CTASlide() {
  return (
    <SlideLayout>
      <GridBackground opacity={0.06} />
      <GlowOrb color="hsl(var(--oe-blue))" size={600} x="20%" y="30%" blur={280} />
      <GlowOrb color="hsl(var(--oe-red))" size={500} x="70%" y="50%" blur={250} />
      <GlowOrb color="hsl(var(--primary))" size={400} x="50%" y="10%" blur={220} />
      <ScanLine />

      <div className="flex-1 flex flex-col items-center justify-center px-20 relative z-10">
        <motion.div
          className="flex items-center gap-5 mb-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <PulsingDot color="bg-oe-blue" delay={0} />
          <PulsingDot color="bg-oe-red" delay={0.3} />
          <PulsingDot color="bg-foreground" delay={0.6} />
        </motion.div>
        <motion.h2
          className="text-[80px] font-semibold font-display leading-[1.05] text-center mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          The perception layer
          <br />
          is <span className="bg-gradient-to-r from-primary via-oe-blue to-oe-green bg-clip-text text-transparent">open.</span>
        </motion.h2>
        <motion.div
          className="space-y-6 text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="font-mono text-[28px] bg-card/80 text-oe-green px-10 py-5 rounded-xl border border-border/60 inline-block backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oe-green/40 to-transparent" />
            pip install openeye-ai
          </div>
        </motion.div>
        <motion.div
          className="flex items-center gap-10 font-mono text-2xl text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <span>github.com/openeye-ai</span>
          <span className="text-primary">·</span>
          <span>Apache 2.0</span>
          <span className="text-primary">·</span>
          <span>openeye.lovable.app</span>
        </motion.div>
      </div>
    </SlideLayout>
  );
}

// ─── Slide Registry ───────────────────────────────────────────────────────

const slides: SlideData[] = [
  { id: "title", content: <TitleSlide /> },
  { id: "problem", content: <ProblemSlide /> },
  { id: "solution", content: <SolutionSlide /> },
  { id: "architecture", content: <ArchitectureSlide /> },
  { id: "models", content: <ModelsSlide /> },
  { id: "safety", content: <SafetySlide /> },
  { id: "plugins", content: <PluginSlide /> },
  { id: "deploy", content: <DeploySlide /> },
  { id: "use-cases", content: <UseCasesSlide /> },
  { id: "cta", content: <CTASlide /> },
];

// ─── Presentation Page ───────────────────────────────────────────────────

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const total = slides.length;

  const goTo = useCallback(
    (n: number) => {
      setCurrent(Math.max(0, Math.min(n, total - 1)));
      setShowGrid(false);
    },
    [total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        if (showGrid) setShowGrid(false);
        else if (document.fullscreenElement) document.exitFullscreen();
        else navigate("/");
      } else if (e.key === "f" || e.key === "F5") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "g") {
        setShowGrid((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate, toggleFullscreen, showGrid]);

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      return;
    }

    const onMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    };

    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(hideTimer.current);
    };
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-background flex flex-col select-none"
      style={{ cursor: isFullscreen && !showControls ? "none" : undefined }}
    >
      {/* Top bar */}
      <AnimatePresence>
        {showControls && !showGrid && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Exit (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="h-6">
                <LogoMark />
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                Slide {current + 1} of {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGrid((v) => !v)}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Grid view (G)"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid view */}
      {showGrid ? (
        <div className="flex-1 overflow-y-auto p-8 pt-16">
          <div className="grid grid-cols-4 gap-6 max-w-[1600px] mx-auto">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                  i === current ? "border-primary shadow-lg" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    style={{
                      width: 1920,
                      height: 1080,
                      transform: "scale(0.18)",
                      transformOrigin: "top left",
                    }}
                  >
                    {slide.content}
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 font-mono text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                  {i + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Main slide */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <ScaledSlide>{slides[current].content}</ScaledSlide>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation arrows */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-y-0 left-0 right-0 z-40 flex items-center justify-between pointer-events-none px-4"
              >
                <button
                  onClick={prev}
                  disabled={current === 0}
                  className="p-3 rounded-full bg-card/80 backdrop-blur-sm border shadow-md pointer-events-auto disabled:opacity-30 disabled:cursor-default hover:bg-card transition-colors text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  disabled={current === total - 1}
                  className="p-3 rounded-full bg-card/80 backdrop-blur-sm border shadow-md pointer-events-auto disabled:opacity-30 disabled:cursor-default hover:bg-card transition-colors text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 z-50 h-1 bg-border">
            <motion.div
              className="h-full bg-gradient-to-r from-oe-blue via-primary to-oe-green"
              animate={{ width: `${((current + 1) / total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </>
      )}
    </div>
  );
}

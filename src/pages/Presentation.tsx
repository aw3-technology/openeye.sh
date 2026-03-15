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
      className={`w-full h-full bg-background text-foreground flex flex-col ${className}`}
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
      <div className="flex-1 flex flex-col items-center justify-center px-20">
        <div className="flex items-center gap-4 mb-10">
          <Diamond className="bg-oe-blue" />
          <Diamond className="bg-oe-red" />
          <Diamond className="bg-foreground" />
        </div>
        <div className="mb-8">
          <LogoMark />
        </div>
        <h1 className="text-[96px] font-semibold font-display leading-[1] text-center tracking-tight mb-8">
          Open-source eyes for
          <br />
          <span className="text-primary">the agent era.</span>
        </h1>
        <p className="text-[32px] text-muted-foreground text-center max-w-[1200px] leading-relaxed">
          A perception engine that turns raw video into structured world models
          for robots and autonomous agents.
        </p>
      </div>
      <div className="pb-12 text-center font-mono text-lg text-muted-foreground">
        github.com/openeye-ai &nbsp;·&nbsp; Apache 2.0
      </div>
    </SlideLayout>
  );
}

// ─── Problem Slide ────────────────────────────────────────────────────────

function ProblemSlide() {
  return (
    <SlideLayout>
      <div className="flex-1 flex px-20 py-20">
        <div className="flex-1 flex flex-col justify-center">
          <div className="font-mono text-xl uppercase tracking-widest text-oe-red mb-6">
            The Problem
          </div>
          <h2 className="text-[72px] font-semibold font-display leading-[1.05] mb-10">
            Robots can move.
            <br />
            They can't <span className="text-oe-red">see.</span>
          </h2>
          <div className="space-y-6 text-[28px] text-muted-foreground leading-relaxed max-w-[900px]">
            <p>Every robotics team rebuilds the same vision stack from scratch — YOLO wrappers, depth pipelines, safety logic, tracking.</p>
            <p>There's no shared, pluggable perception layer for physical AI.</p>
            <p className="text-foreground font-medium">Until now.</p>
          </div>
        </div>
        <div className="w-[500px] flex items-center justify-center">
          <div className="space-y-6 font-mono text-xl text-muted-foreground">
            {["Detection", "Depth", "Tracking", "Scene Graph", "Safety", "Planning"].map((item, i) => (
              <div key={item} className="flex items-center gap-4">
                <span className="text-oe-red text-2xl">✗</span>
                <span className={i < 4 ? "line-through opacity-50" : ""}>{item}</span>
                <span className="text-muted-foreground/40 ml-auto">Built from scratch</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Solution Slide ───────────────────────────────────────────────────────

function SolutionSlide() {
  return (
    <SlideLayout>
      <div className="flex-1 flex flex-col justify-center px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-primary mb-6">
          The Solution
        </div>
        <h2 className="text-[72px] font-semibold font-display leading-[1.05] mb-10">
          One CLI. Any model.
          <br />
          Any camera. <span className="text-primary">Any robot.</span>
        </h2>
        <div className="grid grid-cols-3 gap-10 mt-6">
          {[
            { cmd: "openeye pull yolov8", desc: "Pull open-source vision models from a registry — like Docker for CV." },
            { cmd: "openeye run yolov8 image.jpg", desc: "Run inference on images or live camera feeds with one command." },
            { cmd: "openeye watch --safety", desc: "Real-time workspace monitoring with automatic safety halt." },
          ].map((item) => (
            <div key={item.cmd} className="space-y-4">
              <div className="font-mono text-xl bg-secondary text-oe-green px-5 py-3 rounded-lg border">
                $ {item.cmd}
              </div>
              <p className="text-[24px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Architecture Slide ───────────────────────────────────────────────────

function ArchitectureSlide() {
  const layers = [
    { label: "Input Layer", items: ["USB Camera", "RTSP Stream", "Video File", "Image"], color: "bg-oe-blue" },
    { label: "Perception Pipeline", items: ["Detection (YOLO)", "Depth Estimation", "Object Tracking", "3D Position"], color: "bg-primary" },
    { label: "Intelligence Layer", items: ["Scene Graph", "Safety Evaluation", "Change Detection", "Action Suggestions"], color: "bg-oe-red" },
    { label: "Output Layer", items: ["REST API", "WebSocket", "gRPC", "Event Bus"], color: "bg-foreground" },
  ];

  return (
    <SlideLayout>
      <div className="flex-1 flex flex-col px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6">
          Architecture
        </div>
        <h2 className="text-[60px] font-semibold font-display leading-[1.05] mb-14">
          Multi-stage perception pipeline
        </h2>
        <div className="flex-1 flex items-center">
          <div className="w-full flex gap-6">
            {layers.map((layer, i) => (
              <div key={layer.label} className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-5 h-5 rotate-45 ${layer.color}`} />
                  <span className="font-mono text-lg uppercase tracking-widest text-foreground">
                    {layer.label}
                  </span>
                </div>
                <div className="bg-card border rounded-xl p-6 flex-1 space-y-4">
                  {layer.items.map((item) => (
                    <div key={item} className="font-mono text-xl text-muted-foreground flex items-center gap-3">
                      <span className="text-oe-green">▸</span> {item}
                    </div>
                  ))}
                </div>
                {i < layers.length - 1 && (
                  <div className="flex justify-center my-2 text-muted-foreground text-3xl">→</div>
                )}
              </div>
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
    { name: "YOLOv8", type: "Detection", desc: "Real-time object detection, multiple variants (nano to xlarge)" },
    { name: "Depth Anything v2", type: "Depth", desc: "Monocular depth estimation for 3D spatial reasoning" },
    { name: "Grounding DINO", type: "Open-Vocab", desc: "Text-prompted detection — find anything by description" },
    { name: "SAM2", type: "Segmentation", desc: "Segment Anything Model for precise object masks" },
    { name: "ONNX Runtime", type: "Runtime", desc: "Cross-platform inference with hardware acceleration" },
    { name: "TensorRT", type: "Runtime", desc: "NVIDIA-optimized inference for edge deployment" },
  ];

  return (
    <SlideLayout>
      <div className="flex-1 flex flex-col px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6">
          Model Registry
        </div>
        <h2 className="text-[60px] font-semibold font-display leading-[1.05] mb-14">
          Plug in any model. <span className="text-primary">Swap freely.</span>
        </h2>
        <div className="grid grid-cols-3 gap-6 flex-1">
          {models.map((m) => (
            <div key={m.name} className="bg-card border rounded-xl p-8 flex flex-col">
              <div className="font-mono text-base uppercase tracking-widest text-oe-green mb-3">{m.type}</div>
              <div className="text-[32px] font-semibold mb-3">{m.name}</div>
              <p className="text-xl text-muted-foreground leading-relaxed flex-1">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Safety Slide ─────────────────────────────────────────────────────────

function SafetySlide() {
  return (
    <SlideLayout>
      <div className="flex-1 flex px-20 py-20">
        <div className="flex-1 flex flex-col justify-center">
          <div className="font-mono text-xl uppercase tracking-widest text-oe-red mb-6">
            Safety Guardian
          </div>
          <h2 className="text-[72px] font-semibold font-display leading-[1.05] mb-10">
            Who watches
            <br />
            <span className="text-oe-red">the robots?</span>
          </h2>
          <div className="space-y-8 text-[26px] text-muted-foreground leading-relaxed max-w-[800px]">
            <div className="flex items-start gap-4">
              <span className="font-mono text-oe-green text-2xl mt-1">▸</span>
              <div><strong className="text-foreground">Fast Layer:</strong> YOLO runs every frame — pure geometry for real-time detection.</div>
            </div>
            <div className="flex items-start gap-4">
              <span className="font-mono text-primary text-2xl mt-1">▸</span>
              <div><strong className="text-foreground">Smart Layer:</strong> VLM analyzes periodically for contextual understanding.</div>
            </div>
            <div className="flex items-start gap-4">
              <span className="font-mono text-oe-red text-2xl mt-1">▸</span>
              <div><strong className="text-foreground">Halt Protocol:</strong> Danger detected → halt signal → resume when clear.</div>
            </div>
          </div>
        </div>
        <div className="w-[700px] flex items-center justify-center">
          <div className="w-full bg-card border rounded-xl p-10 font-mono text-lg leading-loose space-y-1">
            <div className="text-oe-green">$ openeye watch --safety</div>
            <div className="text-muted-foreground">[SAFETY] Monitoring workspace...</div>
            <div className="text-oe-green">[SAFETY] ✓ Scene stable — 4 objects</div>
            <div className="text-oe-red">[ANOMALY] ⚠ Human hand in workspace</div>
            <div className="text-oe-red">[SAFETY] → HALT sent to robot</div>
            <div className="text-muted-foreground">[AGENT] Paused. Waiting...</div>
            <div className="text-oe-green">[SAFETY] ✓ Workspace clear. Resumed.</div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Plugin Architecture Slide ────────────────────────────────────────────

function PluginSlide() {
  const plugins = [
    { category: "Input Plugins", items: ["VLM (OpenAI, Gemini)", "Local YOLO", "Video File", "Perception Pipeline"] },
    { category: "LLM Plugins", items: ["OpenAI GPT-4o", "Nebius (Qwen, Llama)", "OpenRouter (free fallbacks)"] },
    { category: "Action Plugins", items: ["Log to console", "Robot connectors", "Custom handlers"] },
    { category: "Adapters", items: ["yolov8", "depth_anything", "grounding_dino", "ONNX / TensorRT"] },
  ];

  return (
    <SlideLayout>
      <div className="flex-1 flex flex-col px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6">
          Extensibility
        </div>
        <h2 className="text-[60px] font-semibold font-display leading-[1.05] mb-14">
          Everything is a <span className="text-primary">plugin.</span>
        </h2>
        <div className="grid grid-cols-4 gap-8 flex-1">
          {plugins.map((p) => (
            <div key={p.category} className="flex flex-col">
              <div className="font-mono text-base uppercase tracking-widest text-primary mb-5">{p.category}</div>
              <div className="bg-card border rounded-xl p-6 flex-1 space-y-4">
                {p.items.map((item) => (
                  <div key={item} className="font-mono text-xl text-muted-foreground">
                    <span className="text-oe-green mr-3">├─</span>{item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 font-mono text-xl text-muted-foreground text-center">
          Discovery-based plugin pattern — drop a file, it's loaded automatically
        </div>
      </div>
    </SlideLayout>
  );
}

// ─── Deployment Slide ─────────────────────────────────────────────────────

function DeploySlide() {
  return (
    <SlideLayout>
      <div className="flex-1 flex flex-col px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6">
          Deployment
        </div>
        <h2 className="text-[60px] font-semibold font-display leading-[1.05] mb-14">
          Your hardware. Your data. <span className="text-primary">Your network.</span>
        </h2>
        <div className="grid grid-cols-3 gap-10 flex-1">
          {[
            {
              label: "Self-Hosted",
              desc: "All inference runs locally. No data leaves your premises. Deploy in air-gapped environments.",
              cmd: "pip install openeye-ai",
            },
            {
              label: "API Server",
              desc: "FastAPI server with REST + WebSocket. Send images, get structured JSON. Built-in dashboard.",
              cmd: "openeye serve yolov8 --port 8000",
            },
            {
              label: "Fleet Management",
              desc: "Register edge devices, deploy models, canary rollouts, rolling updates from the CLI.",
              cmd: "openeye fleet deploy --strategy canary",
            },
          ].map((item) => (
            <div key={item.label} className="bg-card border rounded-xl p-8 flex flex-col">
              <div className="font-mono text-base uppercase tracking-widest text-oe-green mb-4">{item.label}</div>
              <p className="text-[24px] text-muted-foreground leading-relaxed flex-1 mb-6">{item.desc}</p>
              <div className="font-mono text-lg bg-secondary text-oe-green px-4 py-3 rounded-lg border">
                $ {item.cmd}
              </div>
            </div>
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
      <div className="flex-1 flex flex-col px-20 py-20">
        <div className="font-mono text-xl uppercase tracking-widest text-muted-foreground mb-6">
          Use Cases
        </div>
        <h2 className="text-[60px] font-semibold font-display leading-[1.05] mb-14">
          Built for the <span className="text-primary">physical world.</span>
        </h2>
        <div className="grid grid-cols-3 gap-8 flex-1">
          {cases.map((c) => (
            <div key={c.title} className="bg-card border rounded-xl p-8 flex flex-col">
              <div className="text-[48px] mb-4">{c.icon}</div>
              <div className="text-[28px] font-semibold mb-3">{c.title}</div>
              <p className="text-xl text-muted-foreground leading-relaxed flex-1">{c.desc}</p>
            </div>
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
      <div className="flex-1 flex flex-col items-center justify-center px-20">
        <div className="flex items-center gap-4 mb-10">
          <Diamond className="bg-oe-blue" />
          <Diamond className="bg-oe-red" />
          <Diamond className="bg-foreground" />
        </div>
        <h2 className="text-[80px] font-semibold font-display leading-[1.05] text-center mb-8">
          The perception layer
          <br />
          is <span className="text-primary">open.</span>
        </h2>
        <div className="space-y-6 text-center mb-14">
          <div className="font-mono text-[28px] bg-secondary text-oe-green px-8 py-4 rounded-lg border inline-block">
            pip install openeye-ai
          </div>
        </div>
        <div className="flex items-center gap-10 font-mono text-2xl text-muted-foreground">
          <span>github.com/openeye-ai</span>
          <span>·</span>
          <span>Apache 2.0</span>
          <span>·</span>
          <span>openeye.lovable.app</span>
        </div>
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

    onMove(); // start timer
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
              className="h-full bg-primary"
              animate={{ width: `${((current + 1) / total) * 100}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </>
      )}
    </div>
  );
}

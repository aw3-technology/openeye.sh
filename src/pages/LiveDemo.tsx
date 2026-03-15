import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Terminal,
  Shield,
  Eye,
  Crosshair,
  Brain,
  ChevronRight,
  Sparkles,
  ImagePlus,
} from "lucide-react";

// Demo scene images
import safetyWorkspaceImg from "@/assets/demo/safety-workspace.jpg";
import sceneWorkshopImg from "@/assets/demo/scene-workshop.jpg";
import sceneKitchenImg from "@/assets/demo/scene-kitchen.jpg";
import sceneWarehouseImg from "@/assets/demo/scene-warehouse.jpg";

// ─── Types ────────────────────────────────────────────────────────────────

interface DetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  color: "green" | "amber" | "red";
}

interface DemoTab {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

// ─── Demo Tabs ────────────────────────────────────────────────────────────

const tabs: DemoTab[] = [
  { id: "safety", label: "Safety Guardian", icon: Shield, description: "Watch the safety monitoring system detect human intrusion and halt robot operations." },
  { id: "detect", label: "Object Detection", icon: Eye, description: "Upload an image or use our samples to see real-time object detection in action." },
  { id: "vlm", label: "VLM Reasoning", icon: Brain, description: "See how the vision-language model analyzes scenes with deep contextual understanding." },
  { id: "terminal", label: "Interactive CLI", icon: Terminal, description: "Try OpenEye CLI commands and see the output in a live terminal simulation." },
];

// ─── Color Class Maps (explicit for Tailwind JIT) ────────────────────────

const safetyColorClasses = {
  "terminal-red": {
    border: "border-terminal-red",
    bg: "bg-terminal-red/5",
    label: "bg-terminal-red",
  },
  "terminal-green": {
    border: "border-terminal-green",
    bg: "bg-terminal-green/5",
    label: "bg-terminal-green",
  },
} as const;

const detectionColorClasses = {
  green: {
    border: "border-oe-green",
    border2: "border-oe-green",
    bg: "bg-oe-green/10",
    text: "text-oe-green",
    label: "bg-oe-green",
    resultBg: "bg-oe-green/5",
    resultBorder: "border-oe-green/20",
  },
  amber: {
    border: "border-primary",
    border2: "border-primary",
    bg: "bg-primary/10",
    text: "text-primary",
    label: "bg-primary",
    resultBg: "bg-primary/5",
    resultBorder: "border-primary/20",
  },
  red: {
    border: "border-oe-red",
    border2: "border-oe-red",
    bg: "bg-oe-red/10",
    text: "text-oe-red",
    label: "bg-oe-red",
    resultBg: "bg-oe-red/5",
    resultBorder: "border-oe-red/20",
  },
} as const;

// ─── Safety Demo (Virtual) ───────────────────────────────────────────────

const safetyScenario = [
  { time: 0, state: "safe" as const, log: "[14:32:01] System initialized. Monitoring workspace.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 2000, state: "safe" as const, log: "[14:32:03] Scene clear — 4 objects, 0 hazards.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 4000, state: "safe" as const, log: "[14:32:05] Robot executing: sort_objects routine.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 6000, state: "warning" as const, log: "[14:32:08] \u26a0 Motion detected at workspace boundary.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: true },
  { time: 7500, state: "danger" as const, log: "[14:32:09] \ud83d\udd34 HUMAN HAND detected in workspace zone.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 8000, state: "danger" as const, log: "[14:32:09] ACTION: Emergency halt \u2014 robot frozen.", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 10000, state: "danger" as const, log: "[14:32:10] Waiting for workspace to clear...", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 12000, state: "warning" as const, log: "[14:32:12] Hand retreating from workspace zone.", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 13500, state: "safe" as const, log: "[14:32:13] \u2713 Workspace clear. Resuming operations.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 15000, state: "safe" as const, log: "[14:32:15] Robot resumed: sort_objects routine.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
];

const SAFETY_CYCLE = 17000;

function SafetyDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const step = safetyScenario[stepIndex] ?? safetyScenario[0];

  const runCycle = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStepIndex(0);
    setLogs([]);

    safetyScenario.forEach((s, i) => {
      const t = setTimeout(() => {
        setStepIndex(i);
        setLogs((prev) => [...prev, s.log]);
      }, s.time);
      timersRef.current.push(t);
    });

    const loopT = setTimeout(() => setCycleCount((c) => c + 1), SAFETY_CYCLE);
    timersRef.current.push(loopT);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      timersRef.current.forEach(clearTimeout);
      return;
    }
    runCycle();
    return () => timersRef.current.forEach(clearTimeout);
  }, [isPlaying, cycleCount, runCycle]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const stateColor = step.state === "danger" ? "text-oe-red" : step.state === "warning" ? "text-primary" : "text-oe-green";
  const stateBorder = step.state === "danger" ? "border-oe-red" : step.state === "warning" ? "border-primary" : "border-oe-green";
  const stateLabel = step.state.toUpperCase();

  // Workspace objects with positions
  const isHalted = step.objects.some((o) => o.includes("HALTED"));
  const wsObjects = [
    { name: "ROBOT_ARM", x: 30, y: 15, w: 28, h: 50, color: (isHalted ? "terminal-red" : "terminal-green") as keyof typeof safetyColorClasses },
    { name: "RED_CUBE", x: 15, y: 60, w: 10, h: 12, color: "terminal-green" as keyof typeof safetyColorClasses },
    { name: "BLUE_CUP", x: 68, y: 42, w: 10, h: 14, color: "terminal-green" as keyof typeof safetyColorClasses },
    { name: "GREEN_BLOCK", x: 72, y: 62, w: 11, h: 10, color: "terminal-green" as keyof typeof safetyColorClasses },
  ];

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Camera Feed */}
      <div className="lg:col-span-3">
        <motion.div
          className={`relative border-2 rounded-xl overflow-hidden bg-terminal-bg ${stateBorder}`}
          animate={{ borderColor: step.state === "danger" ? "hsl(var(--oe-red))" : step.state === "warning" ? "hsl(var(--primary))" : "hsl(var(--oe-green))" }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative aspect-video bg-terminal-bg">
            {/* Scene image */}
            <img
              src={safetyWorkspaceImg}
              alt="Safety workspace"
              className="absolute inset-0 w-full h-full object-cover opacity-70"
            />

            {/* Grid */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--terminal-green)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--terminal-green)) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            />

            {/* Workspace zone */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <rect x="8%" y="8%" width="84%" height="84%" rx="4" fill="none" strokeDasharray="8 4" strokeWidth="1.5"
                stroke={step.state === "danger" ? "hsl(var(--oe-red) / 0.5)" : "hsl(var(--terminal-green) / 0.2)"}
              />
              <text x="10%" y="7%" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="hsl(var(--terminal-muted))" opacity="0.5">
                WORKSPACE ZONE
              </text>
            </svg>

            {/* Objects */}
            {wsObjects.map((obj) => {
              const cls = safetyColorClasses[obj.color];
              return (
                <div key={obj.name} className="absolute" style={{ left: `${obj.x}%`, top: `${obj.y}%`, width: `${obj.w}%`, height: `${obj.h}%` }}>
                  <div className={`w-full h-full border ${cls.border} ${cls.bg}`} />
                  <span className={`absolute -top-5 left-0 text-[9px] font-mono px-1.5 py-0.5 ${cls.label} text-primary-foreground whitespace-nowrap leading-none`}>
                    {step.objects.find((o) => o.startsWith(obj.name)) ?? obj.name}
                  </span>
                  <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${cls.border}`} />
                  <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${cls.border}`} />
                  <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${cls.border}`} />
                  <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${cls.border}`} />
                </div>
              );
            })}

            {/* Hand intrusion */}
            <AnimatePresence>
              {step.handVisible && (
                <motion.div
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "0%", opacity: 1 }}
                  exit={{ x: "-100%", opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute"
                  style={{ left: "4%", top: "28%", width: "18%", height: "20%" }}
                >
                  <div className="w-full h-full border-2 border-oe-red bg-oe-red/15 animate-pulse" />
                  <span className="absolute -top-5 left-0 text-[9px] font-mono px-1.5 py-0.5 bg-oe-red text-primary-foreground whitespace-nowrap leading-none">
                    HUMAN_HAND [97.3%]
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Danger flash */}
            <AnimatePresence>
              {step.state === "danger" && (
                <motion.div
                  className="absolute inset-0 bg-oe-red/10 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.2, 0.08, 0.15, 0.08] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </AnimatePresence>

            {/* Halt banner */}
            <AnimatePresence>
              {step.state === "danger" && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <div className="bg-oe-red/90 text-primary-foreground font-mono text-sm px-6 py-3 rounded-lg backdrop-blur-sm">
                    HUMAN DETECTED — OPERATIONS HALTED
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* HUD */}
            <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
              <div>OPENEYE GUARDIAN v0.1.0</div>
              <div className="tabular-nums">FPS: 30 | MODE: SAFETY MONITOR</div>
              <div className={stateColor}>STATUS: {stateLabel}</div>
            </div>

            <div className="absolute bottom-3 right-3 font-mono text-[10px] flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${step.state === "danger" ? "bg-oe-red" : "bg-oe-green"}`} />
              <span className={stateColor}>{step.state === "danger" ? "HALTED" : "MONITORING"}</span>
            </div>
          </div>
        </motion.div>

        {/* Playback controls */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg font-mono text-xs hover:bg-secondary transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => { setCycleCount((c) => c + 1); setIsPlaying(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg font-mono text-xs hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
          <div className="ml-auto font-mono text-xs text-muted-foreground">
            Simulated demo — no server required
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Status */}
        <motion.div
          className="rounded-xl border-2 overflow-hidden"
          animate={{
            borderColor: step.state === "danger" ? "hsl(var(--oe-red))" : step.state === "warning" ? "hsl(var(--primary))" : "hsl(var(--oe-green))",
            backgroundColor: step.state === "danger" ? "hsl(var(--oe-red) / 0.05)" : step.state === "warning" ? "hsl(var(--primary) / 0.05)" : "hsl(var(--oe-green) / 0.05)",
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Safety Status</span>
            <motion.div
              className="flex items-center gap-2 font-mono text-base font-semibold"
              animate={{ color: step.state === "danger" ? "hsl(var(--oe-red))" : step.state === "warning" ? "hsl(var(--primary))" : "hsl(var(--oe-green))" }}
            >
              <motion.span
                className="w-3 h-3 rounded-full"
                animate={{
                  backgroundColor: step.state === "danger" ? "hsl(var(--oe-red))" : step.state === "warning" ? "hsl(var(--primary))" : "hsl(var(--oe-green))",
                  boxShadow: step.state === "danger" ? "0 0 12px hsl(var(--oe-red))" : "none",
                }}
              />
              {stateLabel}
            </motion.div>
          </div>
        </motion.div>

        {/* Log */}
        <div className="bg-card rounded-xl border overflow-hidden flex-1 min-h-0">
          <div className="px-5 py-3 border-b border-border">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Safety Log — Live</span>
          </div>
          <div ref={logRef} className="p-4 font-mono text-xs leading-loose space-y-0.5 max-h-[300px] overflow-y-auto scrollbar-thin">
            {logs.map((log, i) => (
              <motion.div
                key={`${cycleCount}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className={
                  log.includes("\ud83d\udd34") || log.includes("halt") || log.includes("HAND")
                    ? "text-oe-red"
                    : log.includes("\u26a0") || log.includes("retreating") || log.includes("Motion")
                    ? "text-primary"
                    : "text-oe-green"
                }
              >
                {log}
              </motion.div>
            ))}
            {logs.length === 0 && <span className="inline-block w-2 h-3.5 bg-oe-green animate-cursor-blink" />}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Latency", value: "<100ms" },
            { label: "Objects", value: String(step.objects.length) },
            { label: "Uptime", value: "99.9%" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg border px-3 py-3 text-center">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className="font-mono text-sm text-oe-green tabular-nums mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Object Detection Playground ──────────────────────────────────────────

const sampleImages: {
  name: string;
  image: string;
  objects: DetectedObject[];
}[] = [
  {
    name: "Workshop",
    image: sceneWorkshopImg,
    objects: [
      { label: "robot_arm", confidence: 0.98, bbox: { x: 0.25, y: 0.1, w: 0.35, h: 0.6 }, color: "green" },
      { label: "screwdriver", confidence: 0.92, bbox: { x: 0.65, y: 0.4, w: 0.1, h: 0.25 }, color: "amber" },
      { label: "circuit_board", confidence: 0.95, bbox: { x: 0.1, y: 0.55, w: 0.2, h: 0.15 }, color: "green" },
      { label: "person", confidence: 0.97, bbox: { x: 0.7, y: 0.05, w: 0.25, h: 0.8 }, color: "red" },
    ],
  },
  {
    name: "Kitchen",
    image: sceneKitchenImg,
    objects: [
      { label: "cup", confidence: 0.94, bbox: { x: 0.6, y: 0.3, w: 0.1, h: 0.15 }, color: "green" },
      { label: "plate", confidence: 0.91, bbox: { x: 0.3, y: 0.45, w: 0.2, h: 0.1 }, color: "green" },
      { label: "knife", confidence: 0.89, bbox: { x: 0.15, y: 0.35, w: 0.05, h: 0.2 }, color: "amber" },
      { label: "apple", confidence: 0.96, bbox: { x: 0.45, y: 0.5, w: 0.08, h: 0.08 }, color: "green" },
      { label: "bottle", confidence: 0.93, bbox: { x: 0.75, y: 0.2, w: 0.08, h: 0.3 }, color: "green" },
    ],
  },
  {
    name: "Warehouse",
    image: sceneWarehouseImg,
    objects: [
      { label: "forklift", confidence: 0.97, bbox: { x: 0.05, y: 0.2, w: 0.3, h: 0.6 }, color: "green" },
      { label: "pallet", confidence: 0.95, bbox: { x: 0.4, y: 0.5, w: 0.25, h: 0.2 }, color: "green" },
      { label: "person", confidence: 0.99, bbox: { x: 0.7, y: 0.1, w: 0.15, h: 0.7 }, color: "red" },
      { label: "hard_hat", confidence: 0.88, bbox: { x: 0.72, y: 0.08, w: 0.1, h: 0.1 }, color: "green" },
    ],
  },
];

// Generic detections for uploaded images
const uploadedImageDetections: DetectedObject[] = [
  { label: "object_1", confidence: 0.93, bbox: { x: 0.12, y: 0.15, w: 0.28, h: 0.35 }, color: "green" },
  { label: "object_2", confidence: 0.87, bbox: { x: 0.52, y: 0.2, w: 0.22, h: 0.45 }, color: "green" },
  { label: "object_3", confidence: 0.79, bbox: { x: 0.3, y: 0.6, w: 0.35, h: 0.25 }, color: "amber" },
];

function DetectionPlayground() {
  const [selectedSample, setSelectedSample] = useState(0);
  const [showDetections, setShowDetections] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [useUpload, setUseUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runDetection = useCallback(() => {
    setShowDetections(false);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowDetections(true);
    }, 800 + Math.random() * 400);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setUseUpload(true);
    setShowDetections(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const sample = useUpload
    ? { name: "Uploaded", image: uploadedImage!, objects: uploadedImageDetections }
    : sampleImages[selectedSample];

  return (
    <div className="space-y-6">
      {/* Sample selector + upload */}
      <div className="flex flex-wrap gap-3">
        {sampleImages.map((s, i) => (
          <button
            key={s.name}
            onClick={() => {
              setSelectedSample(i);
              setUseUpload(false);
              setShowDetections(false);
            }}
            className={`px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
              !useUpload && i === selectedSample
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
            useUpload
              ? "bg-primary/10 border-primary text-primary"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Detection viewport */}
        <div className="lg:col-span-2">
          <div
            className={`relative aspect-video bg-card border rounded-xl overflow-hidden transition-colors ${
              isDragOver ? "border-primary border-2 bg-primary/5" : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Scene image */}
            {(useUpload && uploadedImage) || !useUpload ? (
              <img
                src={sample.image}
                alt={`${sample.name} scene`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}

            {/* Drop zone overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3 font-mono text-sm text-primary">
                  <ImagePlus className="w-8 h-8" />
                  Drop image here
                </div>
              </div>
            )}

            {/* Upload placeholder when no image yet */}
            {useUpload && !uploadedImage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-10 h-10" />
                  <span className="font-mono text-sm">Click or drag an image here</span>
                </button>
              </div>
            )}

            {/* Detection boxes */}
            <AnimatePresence>
              {showDetections &&
                sample.objects.map((obj, i) => {
                  const cls = detectionColorClasses[obj.color];
                  return (
                    <motion.div
                      key={`${useUpload ? "upload" : selectedSample}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.2 }}
                      className="absolute"
                      style={{
                        left: `${obj.bbox.x * 100}%`,
                        top: `${obj.bbox.y * 100}%`,
                        width: `${obj.bbox.w * 100}%`,
                        height: `${obj.bbox.h * 100}%`,
                      }}
                    >
                      <div className={`w-full h-full border-2 ${cls.border} ${cls.bg}`} />
                      <span className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 ${cls.label} text-primary-foreground whitespace-nowrap`}>
                        {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                      </span>
                      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${cls.border}`} />
                      <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${cls.border}`} />
                      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${cls.border}`} />
                      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${cls.border}`} />
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3 font-mono text-sm text-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Running inference...
                </div>
              </div>
            )}
          </div>

          {/* Run button */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={runDetection}
              disabled={isProcessing || (useUpload && !uploadedImage)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-mono text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              <Crosshair className="w-4 h-4" />
              Run Detection
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Simulated YOLOv8 inference — no server required
            </span>
          </div>
        </div>

        {/* Results panel */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Detection Results</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-2 max-h-[400px] overflow-y-auto">
            {showDetections ? (
              <>
                <div className="text-oe-green mb-3">
                  {"\u2713"} Detected {sample.objects.length} objects in {(18 + Math.random() * 12).toFixed(0)}ms
                </div>
                {sample.objects.map((obj, i) => {
                  const cls = detectionColorClasses[obj.color];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`p-2 rounded-lg border ${cls.resultBg} ${cls.resultBorder}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`${cls.text} font-medium`}>{obj.label}</span>
                        <span className="text-muted-foreground tabular-nums">{(obj.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-muted-foreground mt-1 tabular-nums">
                        bbox: [{(obj.bbox.x * 1280).toFixed(0)}, {(obj.bbox.y * 720).toFixed(0)}, {((obj.bbox.x + obj.bbox.w) * 1280).toFixed(0)}, {((obj.bbox.y + obj.bbox.h) * 720).toFixed(0)}]
                      </div>
                    </motion.div>
                  );
                })}
                <div className="pt-3 border-t border-border mt-3 text-muted-foreground">
                  <div>Model: yolov8-xl</div>
                  <div>Resolution: 1280x720</div>
                  <div>Backend: CUDA (simulated)</div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                Click "Run Detection" to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VLM Reasoning Demo ──────────────────────────────────────────────────

const vlmScenes = [
  {
    name: "Workshop",
    image: sceneWorkshopImg,
    objects: [
      { label: "robot_arm", confidence: 0.98, bbox: { x: 0.25, y: 0.1, w: 0.35, h: 0.6 } },
      { label: "person", confidence: 0.97, bbox: { x: 0.7, y: 0.05, w: 0.25, h: 0.8 } },
      { label: "screwdriver", confidence: 0.92, bbox: { x: 0.65, y: 0.4, w: 0.1, h: 0.25 } },
      { label: "circuit_board", confidence: 0.95, bbox: { x: 0.1, y: 0.55, w: 0.2, h: 0.15 } },
    ],
    yoloTime: 23,
    vlm: {
      description: "A robotic arm is positioned over a workbench alongside electronic components. A person is standing within the robot's operational zone, approximately 1.2 meters from the arm's reach envelope.",
      reasoning: "The human operator is within the safety perimeter during what appears to be an active assembly session. The screwdriver and circuit board indicate manual work in progress. Risk level: MODERATE \u2014 the person is close enough for the arm to make contact during a sweep motion.",
      safety: "CAUTION" as const,
      actions: [
        { text: "Reduce arm speed to 30% (collaborative mode)", priority: "high" as const },
        { text: "Enable proximity force-limiting on joints 3\u20136", priority: "high" as const },
        { text: "Alert operator: you are within the safety perimeter", priority: "medium" as const },
      ],
    },
  },
  {
    name: "Kitchen",
    image: sceneKitchenImg,
    objects: [
      { label: "cup", confidence: 0.94, bbox: { x: 0.6, y: 0.3, w: 0.1, h: 0.15 } },
      { label: "knife", confidence: 0.89, bbox: { x: 0.15, y: 0.35, w: 0.05, h: 0.2 } },
      { label: "plate", confidence: 0.91, bbox: { x: 0.3, y: 0.45, w: 0.2, h: 0.1 } },
      { label: "apple", confidence: 0.96, bbox: { x: 0.45, y: 0.5, w: 0.08, h: 0.08 } },
      { label: "bottle", confidence: 0.93, bbox: { x: 0.75, y: 0.2, w: 0.08, h: 0.3 } },
    ],
    yoloTime: 19,
    vlm: {
      description: "A kitchen counter with everyday dining objects arranged in a meal-preparation layout. A knife is positioned near the counter edge beside a plate, with a cup and bottle further back.",
      reasoning: "The knife is oriented with the blade facing outward near the edge \u2014 this represents a potential hazard if the counter is bumped. The remaining objects are in stable positions with no immediate risk of falling or causing harm.",
      safety: "SAFE" as const,
      actions: [
        { text: "Flag knife position as potential edge hazard", priority: "low" as const },
        { text: "Log scene for kitchen safety audit", priority: "low" as const },
      ],
    },
  },
  {
    name: "Warehouse",
    image: sceneWarehouseImg,
    objects: [
      { label: "forklift", confidence: 0.97, bbox: { x: 0.05, y: 0.2, w: 0.3, h: 0.6 } },
      { label: "person", confidence: 0.99, bbox: { x: 0.7, y: 0.1, w: 0.15, h: 0.7 } },
      { label: "pallet", confidence: 0.95, bbox: { x: 0.4, y: 0.5, w: 0.25, h: 0.2 } },
      { label: "hard_hat", confidence: 0.88, bbox: { x: 0.72, y: 0.08, w: 0.1, h: 0.1 } },
    ],
    yoloTime: 21,
    vlm: {
      description: "A warehouse floor with an active forklift transporting materials. A worker wearing a hard hat is standing in the adjacent aisle, within 3 meters of the forklift's travel path.",
      reasoning: "The forklift and person are in close operational proximity. While the worker has proper PPE (hard hat detected), the forklift's trajectory could intersect with the worker's position. This is a high-priority safety scenario requiring immediate intervention.",
      safety: "DANGER" as const,
      actions: [
        { text: "HALT: Signal forklift operator \u2014 person in path", priority: "critical" as const },
        { text: "Activate aisle warning lights", priority: "high" as const },
        { text: "Log near-miss event for safety review", priority: "medium" as const },
      ],
    },
  },
];

function VLMReasoningDemo() {
  const [selectedScene, setSelectedScene] = useState(0);
  const [stage, setStage] = useState<"idle" | "detecting" | "reasoning" | "complete">("idle");
  const [visibleChars, setVisibleChars] = useState(0);
  const [showDetections, setShowDetections] = useState(false);
  const charTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scene = vlmScenes[selectedScene];
  const fullText = `${scene.vlm.description}\n\n${scene.vlm.reasoning}`;

  const analyze = useCallback(() => {
    setShowDetections(false);
    setVisibleChars(0);
    setStage("detecting");
    if (charTimerRef.current) clearInterval(charTimerRef.current);

    // Phase 1: YOLO detection (fast)
    setTimeout(() => {
      setShowDetections(true);
      setStage("reasoning");

      // Phase 2: VLM typewriter
      let chars = 0;
      charTimerRef.current = setInterval(() => {
        chars++;
        setVisibleChars(chars);
        if (chars >= fullText.length) {
          if (charTimerRef.current) clearInterval(charTimerRef.current);
          setStage("complete");
        }
      }, 12);
    }, 600 + Math.random() * 200);
  }, [fullText.length]);

  useEffect(() => {
    return () => {
      if (charTimerRef.current) clearInterval(charTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleChars]);

  const safetyClasses =
    scene.vlm.safety === "DANGER"
      ? { border: "border-oe-red", bg: "bg-oe-red/5", text: "text-oe-red", dot: "bg-oe-red animate-pulse" }
      : scene.vlm.safety === "CAUTION"
      ? { border: "border-primary", bg: "bg-primary/5", text: "text-primary", dot: "bg-primary" }
      : { border: "border-oe-green", bg: "bg-oe-green/5", text: "text-oe-green", dot: "bg-oe-green" };

  return (
    <div className="space-y-6">
      {/* Scene selector */}
      <div className="flex flex-wrap gap-3">
        {vlmScenes.map((s, i) => (
          <button
            key={s.name}
            onClick={() => {
              if (charTimerRef.current) clearInterval(charTimerRef.current);
              setSelectedScene(i);
              setStage("idle");
              setShowDetections(false);
              setVisibleChars(0);
            }}
            className={`px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
              i === selectedScene
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Scene viewport */}
        <div className="lg:col-span-2">
          <div className="relative aspect-video bg-card border rounded-xl overflow-hidden">
            <img src={scene.image} alt={`${scene.name} scene`} className="absolute inset-0 w-full h-full object-cover" />

            {/* YOLO detection boxes */}
            <AnimatePresence>
              {showDetections &&
                scene.objects.map((obj, i) => {
                  const isPerson = obj.label === "person";
                  return (
                    <motion.div
                      key={`${selectedScene}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.2 }}
                      className="absolute"
                      style={{
                        left: `${obj.bbox.x * 100}%`,
                        top: `${obj.bbox.y * 100}%`,
                        width: `${obj.bbox.w * 100}%`,
                        height: `${obj.bbox.h * 100}%`,
                      }}
                    >
                      <div className={`w-full h-full border-2 ${isPerson ? "border-oe-red bg-oe-red/10" : "border-oe-green bg-oe-green/10"}`} />
                      <span className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 ${isPerson ? "bg-oe-red" : "bg-oe-green"} text-primary-foreground whitespace-nowrap`}>
                        {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                      </span>
                      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                      <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Processing overlay */}
            {stage === "detecting" && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <div className="w-4 h-4 border-2 border-oe-green border-t-transparent rounded-full animate-spin" />
                  YOLO detecting...
                </div>
              </div>
            )}

            {/* HUD overlay */}
            <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
              <div>OPENEYE DUAL-LAYER v0.1.0</div>
              <div className="tabular-nums">YOLO + VLM PIPELINE</div>
            </div>

            {/* Stage indicator */}
            {stage !== "idle" && (
              <div className="absolute top-3 right-3">
                <div className={`flex items-center gap-1.5 font-mono text-[10px] bg-card/80 backdrop-blur-sm px-2.5 py-1 rounded border ${
                  stage === "complete" ? "border-oe-green/30 text-oe-green" : "border-primary/30 text-primary"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stage === "complete" ? "bg-oe-green" : "bg-primary animate-pulse"}`} />
                  {stage === "detecting" ? "YOLO" : stage === "reasoning" ? "VLM..." : "COMPLETE"}
                </div>
              </div>
            )}
          </div>

          {/* Analyze button + pipeline badges */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={analyze}
              disabled={stage === "detecting" || stage === "reasoning"}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-mono text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Analyze Scene
            </button>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
              {showDetections && (
                <span className="text-oe-green">YOLO: {scene.yoloTime}ms</span>
              )}
              {stage === "reasoning" && (
                <span className="text-purple-400 animate-pulse">VLM: streaming...</span>
              )}
              {stage === "complete" && (
                <span className="text-purple-400">VLM: 1.8s</span>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: VLM output */}
        <div className="flex flex-col gap-4">
          {/* VLM Reasoning output */}
          <div className="bg-card rounded-xl border overflow-hidden flex-1 min-h-0">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">VLM Reasoning</span>
              </div>
              <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                Nebius Token Factory
              </span>
            </div>
            <div ref={scrollRef} className="p-4 font-mono text-xs leading-relaxed max-h-[320px] overflow-y-auto scrollbar-thin">
              {stage === "idle" ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Sparkles className="w-5 h-5 mx-auto mb-2 opacity-50" />
                  Click "Analyze Scene" to run dual-layer perception
                </div>
              ) : stage === "detecting" ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <div className="w-3 h-3 border-2 border-oe-green border-t-transparent rounded-full animate-spin" />
                  Running YOLO detection...
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Scene Description */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Eye className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-400 uppercase tracking-wider">Scene Description</span>
                    </div>
                    <p className="text-foreground/90 bg-foreground/5 rounded-md p-3 border border-foreground/5">
                      {fullText.slice(0, visibleChars).split("\n\n")[0]}
                      {visibleChars < scene.vlm.description.length && (
                        <span className="inline-block w-1.5 h-3 bg-purple-400 animate-cursor-blink ml-0.5" />
                      )}
                    </p>
                  </div>

                  {/* Reasoning (appears after description is done) */}
                  {visibleChars > scene.vlm.description.length + 2 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] text-purple-400 uppercase tracking-wider">Reasoning</span>
                      </div>
                      <p className="text-foreground/80 bg-foreground/5 rounded-md p-3 border border-foreground/5">
                        {fullText.slice(scene.vlm.description.length + 2, visibleChars)}
                        {visibleChars < fullText.length && (
                          <span className="inline-block w-1.5 h-3 bg-purple-400 animate-cursor-blink ml-0.5" />
                        )}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Safety Assessment */}
          <AnimatePresence>
            {stage === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border-2 overflow-hidden ${safetyClasses.border} ${safetyClasses.bg}`}
              >
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Safety Assessment</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${safetyClasses.dot}`} />
                    <span className={`font-mono text-sm font-semibold ${safetyClasses.text}`}>
                      {scene.vlm.safety}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Plan */}
          <AnimatePresence>
            {stage === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-xl border overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Action Plan</span>
                </div>
                <div className="p-4 space-y-2">
                  {scene.vlm.actions.map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-start gap-2 font-mono text-xs"
                    >
                      <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                        action.priority === "critical" ? "bg-oe-red" :
                        action.priority === "high" ? "bg-primary" :
                        action.priority === "medium" ? "bg-terminal-amber" :
                        "bg-oe-green"
                      }`} />
                      <span className="text-foreground/80">{action.text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pipeline stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "YOLO", value: showDetections ? `${scene.yoloTime}ms` : "\u2014", color: "text-oe-green" },
              { label: "VLM", value: stage === "complete" ? "1.8s" : stage === "reasoning" ? "..." : "\u2014", color: "text-purple-400" },
              { label: "Objects", value: showDetections ? String(scene.objects.length) : "\u2014", color: "text-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-lg border px-3 py-3 text-center">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className={`font-mono text-sm tabular-nums mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground text-center">
        Dual-layer perception: fast YOLO detection + deep VLM reasoning — no server required
      </p>
    </div>
  );
}

// ─── Interactive Terminal ─────────────────────────────────────────────────

interface CLICommand {
  input: string;
  output: string[];
}

const cliCommands: CLICommand[] = [
  {
    input: "openeye list",
    output: [
      "Available models:",
      "",
      "  Name              Task          Status      Size",
      "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      "  yolov8            detection     downloaded  6.2MB",
      "  depth_anything    depth         downloaded  98MB",
      "  grounding_dino    detection     available   340MB",
      "  sam2              segmentation  available   2.4GB",
      "",
      "2 downloaded, 2 available. Use 'openeye pull <name>' to download.",
    ],
  },
  {
    input: "openeye pull grounding_dino",
    output: [
      "[REGISTRY] Resolving grounding_dino...",
      "[DOWNLOAD] Downloading IDEA-Research/grounding-dino-base...",
      "[DOWNLOAD] \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 340MB / 340MB (12.4 MB/s)",
      "[REGISTRY] Verifying checksum... \u2713",
      "[REGISTRY] \u2713 grounding_dino ready at ~/.openeye/models/grounding_dino",
    ],
  },
  {
    input: "openeye run yolov8 photo.jpg --pretty",
    output: [
      "[OPENEYE] Loading model: yolov8...",
      "[VISION] Detected 5 objects in 23ms",
      "",
      "{",
      '  "model": "yolov8",',
      '  "inference_ms": 23.1,',
      '  "detections": [',
      '    {"label": "person",   "confidence": 0.972, "bbox": [120, 45, 340, 520]},',
      '    {"label": "laptop",   "confidence": 0.948, "bbox": [380, 200, 580, 380]},',
      '    {"label": "cup",      "confidence": 0.913, "bbox": [590, 280, 640, 340]},',
      '    {"label": "book",     "confidence": 0.881, "bbox": [60, 300, 180, 420]},',
      '    {"label": "phone",    "confidence": 0.856, "bbox": [420, 150, 470, 210]}',
      "  ]",
      "}",
    ],
  },
  {
    input: "openeye bench yolov8 --runs 20",
    output: [
      "[BENCH] Running 20 iterations on yolov8...",
      "[BENCH] Warm-up complete (2 runs discarded)",
      "",
      "Benchmark Results:",
      "  Model:     yolov8",
      "  Runs:      20",
      "  Backend:   CUDA",
      "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      "  Mean:      18.4ms",
      "  Median:    17.9ms",
      "  P95:       24.1ms",
      "  FPS:       54.3",
      "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      "  \u2713 Benchmark complete",
    ],
  },
  {
    input: "openeye serve yolov8 --port 8000",
    output: [
      "[SERVER] Loading yolov8...",
      "[SERVER] Model loaded in 1.2s",
      "[SERVER] Starting FastAPI server...",
      "",
      "  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
      "  \u2502  OpenEye Inference Server v0.1.0      \u2502",
      "  \u2502                                        \u2502",
      "  \u2502  REST:  http://localhost:8000/predict   \u2502",
      "  \u2502  WS:    ws://localhost:8000/ws          \u2502",
      "  \u2502  Docs:  http://localhost:8000/docs      \u2502",
      "  \u2502  Model: yolov8                          \u2502",
      "  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
      "",
      "[SERVER] Ready. Listening on port 8000...",
    ],
  },
];

function InteractiveCLI() {
  const [activeCmd, setActiveCmd] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cmd = cliCommands[activeCmd];

  useEffect(() => {
    setVisibleLines(0);
    setIsAnimating(true);

    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= cmd.output.length) {
          clearInterval(interval);
          setIsAnimating(false);
          return prev;
        }
        return prev + 1;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [activeCmd, cmd.output.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleLines]);

  const getLineColor = (line: string) => {
    if (line.startsWith("[REGISTRY]") && line.includes("\u2713")) return "text-oe-green";
    if (line.startsWith("[DOWNLOAD]") && line.includes("\u2588")) return "text-primary";
    if (line.startsWith("[VISION]") || line.startsWith("[BENCH]") || line.startsWith("[SCENE]")) return "text-oe-green";
    if (line.startsWith("[OPENEYE]") || line.startsWith("[SERVER]") || line.startsWith("[REGISTRY]") || line.startsWith("[DOWNLOAD]")) return "text-muted-foreground";
    if (line.startsWith("  \u2713") || line.includes("\u2713")) return "text-oe-green";
    if (line.startsWith("  \u2502") || line.startsWith("  \u250c") || line.startsWith("  \u2514")) return "text-primary";
    if (line.startsWith("{") || line.startsWith("}") || line.startsWith('  "') || line.startsWith("  ]")) return "text-oe-green";
    return "text-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Command pills */}
      <div className="flex flex-wrap gap-2">
        {cliCommands.map((c, i) => {
          const label = c.input.split(" ").slice(1, 3).join(" ");
          return (
            <button
              key={c.input}
              onClick={() => setActiveCmd(i)}
              className={`font-mono text-xs px-4 py-2 rounded-lg border transition-colors ${
                i === activeCmd
                  ? "bg-oe-green/10 text-oe-green border-oe-green/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Terminal */}
      <div className="bg-card rounded-xl border overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <div className="w-3 h-3 rounded-full bg-oe-red/20 border border-oe-red/50" />
          <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/50" />
          <div className="w-3 h-3 rounded-full bg-oe-green/20 border border-oe-green/50" />
          <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            openeye — interactive demo
          </span>
        </div>
        <div ref={scrollRef} className="p-5 font-mono text-sm leading-relaxed space-y-0.5 min-h-[280px] max-h-[400px] overflow-y-auto scrollbar-thin">
          <div className="text-oe-green mb-1">$ {cmd.input}</div>
          {cmd.output.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={`${activeCmd}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.1 }}
            >
              <span className={getLineColor(line)}>{line || "\u00A0"}</span>
            </motion.div>
          ))}
          {isAnimating && <span className="inline-block w-2 h-4 bg-oe-green animate-cursor-blink" />}
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground text-center">
        Click a command above to see OpenEye in action — these are real CLI outputs
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function LiveDemo() {
  const [activeTab, setActiveTab] = useState("safety");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="container max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              <span className="w-2 h-2 rotate-45 bg-oe-blue" />
              <span className="w-2 h-2 rotate-45 bg-oe-red" />
              <span className="w-2 h-2 rotate-45 bg-foreground" />
              <span className="ml-1">Live Demo</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-display leading-[1.05] mb-6">
              Try OpenEye. <span className="text-primary">Right now.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              No installation required. Watch the safety guardian in action, run object detection, explore VLM reasoning, or try the CLI — all simulated in your browser.
            </p>
          </motion.div>

          {/* Tab selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border font-mono text-sm transition-all ${
                    activeTab === tab.id
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab description */}
          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-center text-muted-foreground mb-10 max-w-xl mx-auto"
            >
              {tabs.find((t) => t.id === activeTab)?.description}
            </motion.p>
          </AnimatePresence>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "safety" && <SafetyDemo />}
              {activeTab === "detect" && <DetectionPlayground />}
              {activeTab === "vlm" && <VLMReasoningDemo />}
              {activeTab === "terminal" && <InteractiveCLI />}
            </motion.div>
          </AnimatePresence>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <div className="bg-card border rounded-2xl p-10 max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold font-display mb-4">
                Ready to run it for real?
              </h3>
              <p className="text-muted-foreground mb-6">
                Install OpenEye and connect to your own cameras and robots.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="font-mono text-sm bg-secondary text-oe-green px-5 py-2.5 rounded-lg border select-all cursor-text">
                  pip install openeye-ai
                </div>
                <a
                  href="/docs"
                  className="font-mono text-sm bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  Read the Docs <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

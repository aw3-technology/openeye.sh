import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { safetyScenario, SAFETY_CYCLE } from "./safety-demo-data";
import { safetyColorClasses } from "./constants";
import safetyWorkspaceImg from "@/assets/demo/safety-workspace.jpg";

export function SafetyDemo() {
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

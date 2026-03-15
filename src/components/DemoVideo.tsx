import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const terminalLines = [
  { text: "$ openeye watch --mode guardian --workspace table", delay: 0 },
  { text: "", delay: 400 },
  { text: "[INFO] Camera 0 connected — 1280x720 @ 30fps", delay: 800 },
  { text: "[INFO] Loading YOLO26-xl... done (1.2s)", delay: 1600 },
  { text: "[INFO] Loading Qwen3-VL reasoning layer... done", delay: 2400 },
  { text: "[INFO] Guardian mode active. Monitoring workspace.", delay: 3200 },
  { text: "", delay: 3600 },
  { text: "[DETECT] robot_arm: 0.99 — [320, 110, 680, 420]", delay: 4000 },
  { text: "[DETECT] cube_01: 0.94 — [140, 360, 220, 440]", delay: 4400 },
  { text: "[DETECT] cup_01: 0.91 — [700, 290, 760, 370]", delay: 4800 },
  { text: "[SCENE] 3 objects | 0 hazards | workspace CLEAR", delay: 5400 },
  { text: "", delay: 6000 },
  { text: "[DETECT] human_hand: 0.97 — [80, 250, 180, 340]", delay: 6800 },
  { text: "[HAZARD] Hand intrusion detected in workspace zone", delay: 7200 },
  { text: "[HALT] Sending emergency stop to robot controller", delay: 7400 },
  { text: "[HALT] Robot arm STOPPED in 47ms", delay: 7800 },
  { text: "", delay: 8400 },
  { text: "[VLM] Analyzing scene context...", delay: 9000 },
  { text: '[VLM] "Human reaching toward robot workspace near', delay: 9600 },
  { text: '       cube_01. Recommend: wait for hand withdrawal."', delay: 9600 },
  { text: "", delay: 10200 },
  { text: "[CLEAR] Hand withdrawn. Workspace safe.", delay: 11000 },
  { text: "[RESUME] Robot operations resumed.", delay: 11400 },
];

export function DemoVideo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [cycle, setCycle] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isPlaying) {
      setVisibleLines(0);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      return;
    }

    terminalLines.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines(i + 1);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }, line.delay);
      timersRef.current.push(timer);
    });

    // Loop after completing — use cycle counter to force re-trigger
    const loopTimer = setTimeout(() => {
      setVisibleLines(0);
      const restartTimer = setTimeout(() => setCycle((c) => c + 1), 500);
      timersRef.current.push(restartTimer);
    }, 13000);
    timersRef.current.push(loopTimer);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [isPlaying, cycle]);

  // Pause animation when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isPlaying) {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      } else if (!document.hidden && isPlaying) {
        // Restart from current state by bumping cycle
        setCycle((c) => c + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying]);

  const getLineColor = (text: string) => {
    if (text.startsWith("$")) return "text-terminal-green";
    if (text.startsWith("[HALT]")) return "text-terminal-red";
    if (text.startsWith("[HAZARD]")) return "text-terminal-red";
    if (text.startsWith("[VLM]") || text.startsWith("       ")) return "text-terminal-amber";
    if (text.startsWith("[DETECT]")) return "text-terminal-green";
    if (text.startsWith("[SCENE]")) return "text-terminal-green";
    if (text.startsWith("[CLEAR]") || text.startsWith("[RESUME]")) return "text-terminal-green";
    if (text.startsWith("[INFO]")) return "text-terminal-muted";
    return "text-terminal-fg";
  };

  return (
    <section id="demo-video" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center mb-12"
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Live Demo
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Watch OpenEye in real time.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A live camera feed running object detection, scene reasoning, and safety halts — from a single CLI command. This is exactly what you see in production.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Vision feed */}
            <div className="lg:col-span-3 relative aspect-video bg-card rounded-outer border overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-card">
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `linear-gradient(hsl(var(--terminal-green)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--terminal-green)) 1px, transparent 1px)`,
                    backgroundSize: "60px 60px",
                  }}
                />

                {/* Workspace zone */}
                <div className="absolute top-[10%] left-[10%] w-[80%] h-[80%] border border-dashed border-terminal-green/20" />

                {/* Robot arm */}
                <div className="absolute top-[15%] left-[30%] w-[35%] h-[55%]">
                  <div
                    className={`w-full h-full border rounded-sm transition-colors duration-300 ${
                      isPlaying && visibleLines >= 14
                        ? visibleLines >= 21
                          ? "border-terminal-green/30 bg-terminal-green/5"
                          : "border-terminal-red/50 bg-terminal-red/10"
                        : "border-terminal-green/30 bg-terminal-green/5"
                    }`}
                  />
                  <span
                    className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 text-primary-foreground transition-colors duration-300 ${
                      isPlaying && visibleLines >= 14 && visibleLines < 21
                        ? "bg-terminal-red/80"
                        : "bg-terminal-green/80"
                    }`}
                  >
                    {isPlaying && visibleLines >= 14 && visibleLines < 21
                      ? "ROBOT_ARM — HALTED"
                      : "ROBOT_ARM"}
                  </span>
                </div>

                {/* Objects */}
                <div className={`absolute top-[50%] left-[15%] w-[12%] h-[18%] transition-opacity duration-300 ${isPlaying && visibleLines >= 9 ? "opacity-100" : "opacity-60"}`}>
                  <div className="w-full h-full border border-terminal-green/40 bg-terminal-green/5" />
                  <span className="absolute -top-4 left-0 text-[9px] font-mono text-terminal-green/70">cube_01</span>
                </div>

                <div className={`absolute top-[40%] left-[72%] w-[10%] h-[20%] transition-opacity duration-300 ${isPlaying && visibleLines >= 10 ? "opacity-100" : "opacity-60"}`}>
                  <div className="w-full h-full border border-terminal-green/40 bg-terminal-green/5" />
                  <span className="absolute -top-4 left-0 text-[9px] font-mono text-terminal-green/70">cup_01</span>
                </div>

                {/* Human hand intrusion */}
                {isPlaying && visibleLines >= 13 && visibleLines < 21 && (
                  <motion.div
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="absolute top-[35%] left-[5%] w-[14%] h-[20%]"
                  >
                    <div className="w-full h-full border-2 border-terminal-red/70 bg-terminal-red/15 rounded-sm animate-pulse" />
                    <span className="absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 bg-terminal-red/80 text-primary-foreground">
                      HUMAN_HAND
                    </span>
                  </motion.div>
                )}

                {/* HUD */}
                <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/50 space-y-0.5">
                  <div>OPENEYE v0.1.0 — LIVE</div>
                  <div className="tabular-nums">30 FPS | 1280x720 | YOLO26-xl</div>
                  <div
                    className={`transition-colors duration-300 ${
                      isPlaying && visibleLines >= 14 && visibleLines < 21
                        ? "text-terminal-red"
                        : "text-terminal-green"
                    }`}
                  >
                    STATUS: {isPlaying && visibleLines >= 14 && visibleLines < 21 ? "HALTED" : "MONITORING"}
                  </div>
                </div>

                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  <div
                    className={`flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded-inner transition-colors duration-300 ${
                      isPlaying && visibleLines >= 14 && visibleLines < 21
                        ? "bg-terminal-red/20 text-terminal-red border border-terminal-red/30"
                        : "bg-terminal-green/20 text-terminal-green border border-terminal-green/30"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isPlaying && visibleLines >= 14 && visibleLines < 21
                        ? "bg-terminal-red animate-pulse"
                        : "bg-terminal-green"
                    }`} />
                    {isPlaying && visibleLines >= 14 && visibleLines < 21 ? "DANGER" : "SAFE"}
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 font-mono text-[9px] text-terminal-muted/40">
                  Recorded at Nebius.Build Hackathon — SF 2026
                </div>
              </div>

              {/* Play button */}
              {!isPlaying && (
                <button
                  className="absolute inset-0 flex items-center justify-center bg-card/50 hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors cursor-pointer"
                  onClick={() => setIsPlaying(true)}
                  aria-label="Play demo animation"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full bg-terminal-green/90 flex items-center justify-center shadow-lg backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1" aria-hidden="true">
                      <path d="M8 5v14l11-7z" fill="hsl(0, 0%, 7%)" />
                    </svg>
                  </motion.div>
                </button>
              )}
            </div>

            {/* Live terminal output */}
            <div className="lg:col-span-2 bg-card rounded-outer border overflow-hidden shadow-lg flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/20 border border-terminal-red/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-amber/20 border border-terminal-amber/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/20 border border-terminal-green/50" />
                <span className="ml-1 text-[10px] font-mono text-terminal-muted uppercase tracking-widest">
                  terminal
                </span>
              </div>
              <div
                ref={terminalRef}
                className="flex-1 p-3 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[300px] lg:max-h-none"
              >
                {isPlaying ? (
                  terminalLines.slice(0, visibleLines).map((line, i) => (
                    <div key={i} className={line.text ? getLineColor(line.text) : "h-3"}>
                      {line.text || "\u00A0"}
                    </div>
                  ))
                ) : (
                  <div className="text-terminal-muted flex items-center justify-center h-full min-h-[120px]">
                    <span>Click play to start the demo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {["Real-time detection", "Safety halt in 47ms", "VLM reasoning", "Live terminal output"].map((tag) => (
              <span
                key={tag}
                className="font-mono text-[11px] text-terminal-muted px-3 py-1 border border-foreground/[0.06] rounded-inner"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

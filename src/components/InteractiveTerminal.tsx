import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

interface TerminalLine {
  text: string;
  color: "green" | "amber" | "red" | "muted" | "default";
}

interface Command {
  input: string;
  output: TerminalLine[];
}

const commands: Command[] = [
  {
    input: "openeye run yolov8 photo.jpg --pretty",
    output: [
      { text: "[OPENEYE] Loading model: yolov8...", color: "muted" },
      { text: "[VISION] Detected 5 objects in 23ms", color: "green" },
      { text: '  ├─ person   (97.2%)  bbox: [120, 45, 340, 520]', color: "green" },
      { text: '  ├─ laptop   (94.8%)  bbox: [380, 200, 580, 380]', color: "green" },
      { text: '  ├─ cup      (91.3%)  bbox: [590, 280, 640, 340]', color: "green" },
      { text: '  ├─ book     (88.1%)  bbox: [60, 300, 180, 420]', color: "green" },
      { text: '  └─ phone    (85.6%)  bbox: [420, 150, 470, 210]', color: "green" },
      { text: "", color: "default" },
      { text: "[DONE] Results saved to output.json", color: "muted" },
    ],
  },
  {
    input: "openeye list",
    output: [
      { text: "Available models:", color: "green" },
      { text: "", color: "default" },
      { text: "  Name              Task            Status      Size", color: "default" },
      { text: "  ─────────────────────────────────────────────────────", color: "muted" },
      { text: "  yolov8            detection       downloaded  6.2MB", color: "green" },
      { text: "  yolo26            detection       downloaded  5.0MB", color: "green" },
      { text: "  rfdetr            detection       downloaded  120MB", color: "green" },
      { text: "  grounding_dino    grounding       downloaded  341MB", color: "green" },
      { text: "  depth_anything    depth           downloaded  98MB", color: "green" },
      { text: "  sam2              segmentation    downloaded  150MB", color: "green" },
      { text: "  smolvla           vla             available   500MB", color: "amber" },
      { text: "", color: "default" },
      { text: "6 downloaded, 1 available. Use 'openeye pull <name>' to download.", color: "muted" },
    ],
  },
  {
    input: "openeye watch --models yolov8 --safety",
    output: [
      { text: "[OPENEYE] Loading model: yolov8...", color: "muted" },
      { text: "[WATCH] Camera initialized (USB /dev/video0)", color: "muted" },
      { text: "[SAFETY] Guardian active — danger: 0.5m, caution: 1.5m", color: "green" },
      { text: "", color: "default" },
      { text: " Model    Label    Conf   Zone       Dist   Latency", color: "default" },
      { text: " ────────────────────────────────────────────────────", color: "muted" },
      { text: " yolov8   cup      91.3%  SAFE       2.1m   18ms", color: "green" },
      { text: " yolov8   person   97.2%  CAUTION    1.2m   18ms", color: "amber" },
      { text: " yolov8   hand     94.1%  DANGER     0.3m   18ms", color: "red" },
      { text: "", color: "default" },
      { text: "[SAFETY] HALT — human hand in danger zone (0.3m)", color: "red" },
      { text: "[WATCH] FPS: 30 | Latency: 18ms | Objects: 3", color: "green" },
    ],
  },
  {
    input: "openeye serve yolov8 --port 8000 --demo",
    output: [
      { text: "[SERVER] Loading yolov8...", color: "muted" },
      { text: "[SERVER] Model loaded in 1.2s", color: "muted" },
      { text: "[SERVER] Starting FastAPI server...", color: "muted" },
      { text: "", color: "default" },
      { text: "  ┌─────────────────────────────────────────────┐", color: "amber" },
      { text: "  │  OpenEye Inference Server v0.1.0             │", color: "amber" },
      { text: "  │                                               │", color: "amber" },
      { text: "  │  Dashboard:   http://localhost:8000/           │", color: "amber" },
      { text: "  │  REST API:    http://localhost:8000/predict    │", color: "amber" },
      { text: "  │  WebSocket:   ws://localhost:8000/ws           │", color: "amber" },
      { text: "  │  Perception:  ws://localhost:8000/ws/perception│", color: "amber" },
      { text: "  │  VLM:         ws://localhost:8000/ws/vlm       │", color: "amber" },
      { text: "  │  Agentic:     ws://localhost:8000/ws/agentic   │", color: "amber" },
      { text: "  │  Metrics:     http://localhost:8000/metrics    │", color: "amber" },
      { text: "  └─────────────────────────────────────────────┘", color: "amber" },
      { text: "", color: "default" },
      { text: "[SERVER] Ready. Listening on port 8000...", color: "green" },
    ],
  },
  {
    input: "openeye g1-demo --control-mode dry_run",
    output: [
      { text: "[OPENEYE] Loading yolov8 for safety detection...", color: "muted" },
      { text: "[G1-DEMO] Unitree G1 connector: DRY_RUN mode", color: "muted" },
      { text: "[SAFETY] Guardian active — 3-zone monitoring", color: "green" },
      { text: "", color: "default" },
      { text: "         ╭─────── SAFE (>1.5m) ───────╮", color: "green" },
      { text: "         │  ╭── CAUTION (<1.5m) ──╮   │", color: "amber" },
      { text: "         │  │  ╭─ DANGER ──╮      │   │", color: "red" },
      { text: "         │  │  │  [ROBOT]   │      │   │", color: "red" },
      { text: "         │  │  ╰────────────╯      │   │", color: "red" },
      { text: "         │  ╰──────────────────────╯   │", color: "amber" },
      { text: "         ╰─────────────────────────────╯", color: "green" },
      { text: "", color: "default" },
      { text: "[14:32:09] Person detected — DANGER zone (0.3m)", color: "red" },
      { text: "[14:32:09] Robot HALTED — waiting for clear...", color: "red" },
      { text: "[14:32:13] Zone clear. Robot RESUMED.", color: "green" },
    ],
  },
];

const colorMap = {
  green: "text-terminal-green",
  amber: "text-terminal-amber",
  red: "text-terminal-red",
  muted: "text-terminal-muted",
  default: "text-terminal-fg",
};

export function InteractiveTerminal() {
  const [activeCommand, setActiveCommand] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const currentCommand = commands[activeCommand];

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisibleLines(currentCommand.output.length);
      setIsAnimating(false);
      return;
    }

    setVisibleLines(0);
    setIsAnimating(true);

    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= currentCommand.output.length) {
          clearInterval(interval);
          setIsAnimating(false);
          return prev;
        }
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeCommand, currentCommand.output.length, shouldReduceMotion]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const handleCommandClick = (index: number) => {
    if (index === activeCommand) return;
    setActiveCommand(index);
  };

  return (
    <div className="space-y-3">
      {/* Command selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Terminal commands">
        {commands.map((cmd, i) => {
          const label = cmd.input.split(" ")[1];
          return (
            <button
              type="button"
              key={cmd.input}
              onClick={() => handleCommandClick(i)}
              role="tab"
              aria-selected={activeCommand === i}
              aria-label={`Run ${cmd.input}`}
              className={`font-mono text-xs whitespace-nowrap px-3 py-1.5 rounded-inner border transition-all focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none ${
                activeCommand === i
                  ? "bg-terminal-green/15 text-terminal-green border-terminal-green/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Terminal window */}
      <div className="bg-card rounded-outer border overflow-hidden shadow-lg">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="w-3 h-3 rounded-full bg-terminal-red/20 border border-terminal-red/50" />
          <div className="w-3 h-3 rounded-full bg-terminal-amber/20 border border-terminal-amber/50" />
          <div className="w-3 h-3 rounded-full bg-terminal-green/20 border border-terminal-green/50" />
          <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            openeye — interactive demo
          </span>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          className="p-4 md:p-6 font-mono text-sm leading-relaxed space-y-0.5 min-h-[240px] max-h-[320px] overflow-y-auto scrollbar-thin"
        >
          {/* Command input line */}
          <div className="text-terminal-green mb-1">
            $ {currentCommand.input}
          </div>

          {/* Output lines */}
          {currentCommand.output.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={`${activeCommand}-${i}`}
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={colorMap[line.color]}>{line.text}</span>
            </motion.div>
          ))}

          {/* Blinking cursor */}
          {isAnimating && (
            <span className="inline-block w-2 h-4 bg-terminal-green animate-cursor-blink" />
          )}
        </div>
      </div>

      <p className="font-mono text-[11px] text-muted-foreground text-center">
        Click a command above to see OpenEye in action
      </p>
    </div>
  );
}

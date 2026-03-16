import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

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

export function InteractiveCLI() {
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

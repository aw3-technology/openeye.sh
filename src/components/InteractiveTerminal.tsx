import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ease } from "@/lib/motion";

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
    input: "openeye detect image.jpg",
    output: [
      { text: "[OPENEYE] Loading model: yolo26-xl...", color: "muted" },
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
    input: "openeye scene workshop.mp4 --frame 120",
    output: [
      { text: "[OPENEYE] Extracting frame 120...", color: "muted" },
      { text: "[VISION] Running detection + segmentation...", color: "muted" },
      { text: "[SCENE] Scene graph generated:", color: "green" },
      { text: "  workspace/", color: "green" },
      { text: "    ├─ robot_arm (active) → holding: screwdriver", color: "green" },
      { text: "    ├─ screwdriver (tool) → held_by: robot_arm", color: "green" },
      { text: "    ├─ circuit_board → on: workbench", color: "green" },
      { text: "    └─ soldering_iron → near: circuit_board", color: "amber" },
      { text: "", color: "default" },
      { text: "[HAZARD] soldering_iron is 3cm from circuit_board", color: "amber" },
      { text: "[DONE] Scene graph: 4 objects, 3 relations, 1 hazard", color: "green" },
    ],
  },
  {
    input: "openeye watch --mode guardian --workspace table",
    output: [
      { text: "[OPENEYE] Camera initialized (USB /dev/video0)", color: "muted" },
      { text: "[GUARDIAN] Workspace zone defined: table", color: "muted" },
      { text: "[GUARDIAN] Monitoring at 30 FPS...", color: "green" },
      { text: "", color: "default" },
      { text: "[14:32:01] Scene clear — 3 objects, 0 hazards", color: "green" },
      { text: "[14:32:03] Robot executing: sort_objects", color: "green" },
      { text: "[14:32:08] Motion detected at workspace boundary", color: "amber" },
      { text: "[14:32:09] HUMAN HAND detected in workspace zone", color: "red" },
      { text: "[14:32:09] ACTION: Emergency halt — robot frozen", color: "red" },
      { text: "[14:32:13] Workspace clear. Resuming operations.", color: "green" },
    ],
  },
  {
    input: 'openeye plan "organize desk for assembly"',
    output: [
      { text: "[OPENEYE] Loading scene context...", color: "muted" },
      { text: "[SCENE] 6 objects detected, 2 hazards flagged", color: "muted" },
      { text: "[LLM] Reasoning with Qwen2.5-VL via Nebius...", color: "muted" },
      { text: "", color: "default" },
      { text: "[PLAN] Generated 4-step action plan:", color: "green" },
      { text: "  1. Move soldering_iron → safe_zone (hazard)", color: "green" },
      { text: "  2. Move loose_screws → parts_tray", color: "green" },
      { text: "  3. Position circuit_board → center_workspace", color: "green" },
      { text: "  4. Retrieve screwdriver → tool_rack", color: "green" },
      { text: "", color: "default" },
      { text: "[EXEC] Ready to send to robot adapter.", color: "amber" },
    ],
  },
  {
    input: 'openeye agent --goal "monitor workspace safety"',
    output: [
      { text: "[OPENEYE] Loading yolov8...", color: "muted" },
      { text: "[AGENT] Starting perception loop at 1 Hz", color: "muted" },
      { text: "", color: "default" },
      { text: "[TICK 1] PERCEIVE: 3 objects — desk, laptop, cup", color: "green" },
      { text: "[TICK 1] RECALL: No prior observations", color: "muted" },
      { text: "[TICK 1] REASON: Workspace clear, monitoring for changes", color: "green" },
      { text: "[TICK 1] PLAN: [1. Monitor for human entry  2. Track object positions]", color: "green" },
      { text: "", color: "default" },
      { text: "[TICK 4] PERCEIVE: 4 objects — person detected (97.2%)", color: "green" },
      { text: "[TICK 4] RECALL: Previously desk was empty (ticks 1-3)", color: "muted" },
      { text: "[TICK 4] REASON: Person entered workspace. Adjusting plan for safety.", color: "amber" },
      { text: "[TICK 4] PLAN: [1. Track person  2. Monitor hand proximity  3. Alert if near tools]", color: "amber" },
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
              transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease }}
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

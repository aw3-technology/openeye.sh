import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { SafetyState, LogEntry } from "./types";
import { stateConfig, logColorMap } from "./data";

interface SafetyPanelProps {
  currentState: SafetyState;
  logs: LogEntry[];
  cycleId: number;
}

export function SafetyPanel({ currentState, logs, cycleId }: SafetyPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const config = stateConfig[currentState];
  const animDuration = shouldReduceMotion ? 0 : 0.15;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      {/* Status indicator */}
      <motion.div
        className="rounded-outer border overflow-hidden"
        role="status"
        aria-label={`Safety status: ${config.label}`}
        animate={{
          borderColor: config.border,
          backgroundColor: config.bg,
        }}
        transition={{ duration: animDuration }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Safety Status
          </span>
          <motion.div
            className="flex items-center gap-2 font-mono text-sm font-medium"
            animate={{ color: config.border }}
            transition={{ duration: animDuration }}
          >
            <motion.span
              className="w-2.5 h-2.5 rounded-full"
              animate={{
                backgroundColor: config.border,
                boxShadow: currentState === "danger"
                  ? `0 0 8px hsl(var(--terminal-red))`
                  : "none",
              }}
              transition={{ duration: animDuration }}
            />
            {config.label}
          </motion.div>
        </div>
      </motion.div>

      {/* Log */}
      <div className="bg-card rounded-outer border overflow-hidden flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Safety Log — live
          </span>
        </div>
        <div
          ref={logRef}
          className="p-4 font-mono text-xs leading-relaxed space-y-1 max-h-[200px] sm:max-h-[240px] lg:max-h-[280px] overflow-y-auto"
        >
          {logs.map((entry, i) => (
            <motion.div
              key={`c${cycleId}-${i}`}
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: animDuration }}
              className={logColorMap[entry.level]}
            >
              <span className="text-terminal-muted">[{entry.time}]</span>{" "}
              {entry.message}
            </motion.div>
          ))}
          {logs.length === 0 && (
            <span className="inline-block w-2 h-3.5 bg-terminal-green animate-cursor-blink" />
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Latency", value: "<100ms" },
          { label: "Objects", value: "4" },
          { label: "Uptime", value: "99.9%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-inner border px-3 py-2 text-center"
          >
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </div>
            <div className="font-mono text-sm text-terminal-green tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

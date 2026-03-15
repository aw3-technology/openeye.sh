import { motion, AnimatePresence } from "framer-motion";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import { useEffect, useRef, useState } from "react";
import type { SafetyAlert } from "@/types/openeye";

const stateConfig = {
  safe: {
    label: "SAFE",
    border: "hsl(var(--terminal-green))",
    bg: "hsl(var(--terminal-green) / 0.05)",
  },
  caution: {
    label: "CAUTION",
    border: "hsl(var(--terminal-amber))",
    bg: "hsl(var(--terminal-amber) / 0.05)",
  },
  danger: {
    label: "DANGER",
    border: "hsl(var(--terminal-red))",
    bg: "hsl(var(--terminal-red) / 0.05)",
  },
};

const logColorMap: Record<string, string> = {
  safe: "text-terminal-green",
  caution: "text-terminal-amber",
  danger: "text-terminal-red",
};

interface LogEntry {
  id: number;
  message: string;
  zone: string;
  timestamp: string;
}

let logCounter = 0;

export function SafetyPanel() {
  const { overallSafetyState, haltActive, latestFrame } = usePerceptionStream();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const config = stateConfig[overallSafetyState];

  useEffect(() => {
    if (!latestFrame) return;

    const newEntries: LogEntry[] = [];

    if (latestFrame.safety_alerts.length > 0) {
      for (const alert of latestFrame.safety_alerts) {
        newEntries.push({
          id: ++logCounter,
          message: alert.message,
          zone: alert.zone,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        });
      }
    } else if (latestFrame.objects.length > 0) {
      // Only add "Scene clear" occasionally to avoid spam
      if (Math.random() < 0.05) {
        newEntries.push({
          id: ++logCounter,
          message: `Scene clear — ${latestFrame.objects.length} objects, 0 hazards.`,
          zone: "safe",
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        });
      }
    }

    if (newEntries.length > 0) {
      setLogs((prev) => [...prev, ...newEntries].slice(-50));
    }
  }, [latestFrame]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col gap-3">
      {/* Status indicator */}
      <motion.div
        className="rounded-outer border overflow-hidden"
        animate={{
          borderColor: config.border,
          backgroundColor: config.bg,
        }}
        transition={{ duration: 0.15 }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-terminal-muted">
            Safety Status
          </span>
          <motion.div
            className="flex items-center gap-2 font-mono text-sm font-medium"
            animate={{ color: config.border }}
            transition={{ duration: 0.15 }}
          >
            <motion.span
              className="w-2.5 h-2.5 rounded-full"
              animate={{
                backgroundColor: config.border,
                boxShadow: overallSafetyState === "danger"
                  ? "0 0 8px hsl(var(--terminal-red))"
                  : "none",
              }}
              transition={{ duration: 0.15 }}
            />
            {haltActive ? "HALT" : config.label}
          </motion.div>
        </div>
      </motion.div>

      {/* Safety log */}
      <div className="bg-card rounded-outer border overflow-hidden flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Safety Log — live
          </span>
        </div>
        <div
          ref={logRef}
          className="p-4 font-mono text-xs leading-relaxed space-y-1 max-h-[200px] overflow-y-auto"
        >
          <AnimatePresence initial={false}>
            {logs.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={logColorMap[entry.zone] || "text-terminal-fg"}
              >
                <span className="text-terminal-muted">[{entry.timestamp}]</span>{" "}
                {entry.message}
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <span className="inline-block w-2 h-3.5 bg-terminal-green animate-cursor-blink" />
          )}
        </div>
      </div>
    </div>
  );
}

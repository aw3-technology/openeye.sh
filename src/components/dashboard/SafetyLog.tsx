import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PERSON_DANGER_THRESHOLD,
  PERSON_CAUTION_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/safety-thresholds";

interface SafetyLogEntry {
  id: number;
  message: string;
  level: "safe" | "caution" | "danger";
  timestamp: string;
}

let safetyLogCounter = 0;

const levelColors: Record<string, string> = {
  safe: "text-terminal-green",
  caution: "text-terminal-amber",
  danger: "text-red-400",
};

export function SafetyLog({ isStreaming, objects }: {
  isStreaming: boolean;
  objects: { label: string; confidence: number; bbox: { h: number } }[];
}) {
  const [logs, setLogs] = useState<SafetyLogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const prevObjCountRef = useRef(0);

  useEffect(() => {
    if (!isStreaming || objects.length === 0) return;

    const entries: SafetyLogEntry[] = [];
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    const persons = objects.filter((o) => o.label.toLowerCase() === "person");
    const hazards = objects.filter(
      (o) => o.label.toLowerCase().includes("knife") || o.confidence < LOW_CONFIDENCE_THRESHOLD,
    );

    // Person proximity alerts
    for (const p of persons) {
      if (p.bbox.h > PERSON_DANGER_THRESHOLD) {
        entries.push({
          id: ++safetyLogCounter,
          message: "Person in DANGER zone — too close",
          level: "danger",
          timestamp: ts,
        });
      } else if (p.bbox.h > PERSON_CAUTION_THRESHOLD) {
        entries.push({
          id: ++safetyLogCounter,
          message: "Person in CAUTION zone",
          level: "caution",
          timestamp: ts,
        });
      }
    }

    // Hazard alerts
    for (const h of hazards) {
      entries.push({
        id: ++safetyLogCounter,
        message: `Hazard detected: ${h.label} (${(h.confidence * 100).toFixed(0)}%)`,
        level: "danger",
        timestamp: ts,
      });
    }

    // Scene clear occasionally
    if (entries.length === 0 && Math.random() < 0.03) {
      entries.push({
        id: ++safetyLogCounter,
        message: `Scene clear — ${objects.length} objects, 0 hazards`,
        level: "safe",
        timestamp: ts,
      });
    }

    // New objects appeared
    if (objects.length > prevObjCountRef.current && prevObjCountRef.current > 0) {
      const delta = objects.length - prevObjCountRef.current;
      entries.push({
        id: ++safetyLogCounter,
        message: `+${delta} new object${delta > 1 ? "s" : ""} detected`,
        level: "safe",
        timestamp: ts,
      });
    }

    prevObjCountRef.current = objects.length;

    if (entries.length > 0) {
      setLogs((prev) => [...prev, ...entries].slice(-40));
    }
  }, [isStreaming, objects]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!isStreaming) {
      setLogs([]);
      prevObjCountRef.current = 0;
    }
  }, [isStreaming]);

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-terminal-green" />
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
            Safety Log
          </CardTitle>
          {logs.length > 0 && (
            <Badge variant="outline" className="text-[9px] font-mono ml-auto">
              {logs.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={logRef}
          className="font-mono text-[11px] leading-relaxed space-y-0.5 max-h-[140px] overflow-y-auto pr-1"
        >
          <AnimatePresence initial={false}>
            {logs.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.12 }}
                className={levelColors[entry.level]}
              >
                <span className="text-muted-foreground">[{entry.timestamp}]</span>{" "}
                {entry.message}
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="text-muted-foreground flex items-center gap-1.5 py-2">
              {isStreaming ? (
                <>
                  <span className="inline-block w-1.5 h-3 bg-terminal-green animate-[cursor-blink_1s_step-end_infinite]" />
                  <span>Monitoring...</span>
                </>
              ) : (
                "Start camera to enable safety monitoring."
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

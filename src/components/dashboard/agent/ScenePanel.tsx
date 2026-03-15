import { motion, AnimatePresence } from "framer-motion";
import { Eye, Scan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DetectedObject } from "@/types/openeye";

const phaseRing: Record<string, string> = {
  perceive: "ring-terminal-green/40",
  recall: "ring-blue-400/30",
  reason: "ring-terminal-amber/40",
  act: "ring-orange-400/40",
};

interface ScenePanelProps {
  detections: DetectedObject[];
  tickNumber: number;
  sceneSummary: string;
  isRunning?: boolean;
  phase?: string;
}

export function ScenePanel({
  detections,
  tickNumber,
  sceneSummary,
  isRunning = false,
  phase = "idle",
}: ScenePanelProps) {
  const ring = isRunning ? phaseRing[phase] ?? "" : "";

  return (
    <Card className={`border-terminal-green/20 ${ring ? `ring-1 ${ring}` : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Scan className="h-4 w-4" />
          SCENE VIEW
          <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30 tabular-nums">
            Tick {tickNumber}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Detection overlay area */}
        <div className="relative bg-black/90 rounded-lg overflow-hidden min-h-[220px]">
          {/* Scanline effect */}
          {isRunning && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
                }}
              />
            </div>
          )}

          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]">
            <div
              className="w-full h-full"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "25% 25%",
              }}
            />
          </div>

          {/* Empty state */}
          {detections.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground/50">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-mono">
                  {isRunning ? "Scanning..." : "No detections"}
                </p>
              </div>
            </div>
          )}

          {/* Detection bounding boxes */}
          <AnimatePresence>
            {detections.map((obj, i) => {
              const isHazard =
                obj.label.toLowerCase().includes("soldering") ||
                obj.label.toLowerCase().includes("knife");
              const isPerson = obj.label === "person";
              const borderColor = isHazard
                ? "border-terminal-red"
                : isPerson
                  ? "border-terminal-amber"
                  : "border-terminal-green";
              const bgColor = isHazard
                ? "bg-terminal-red/8"
                : isPerson
                  ? "bg-terminal-amber/8"
                  : "bg-terminal-green/8";
              const labelBg = isHazard
                ? "bg-terminal-red text-white"
                : isPerson
                  ? "bg-terminal-amber text-primary-foreground"
                  : "bg-terminal-green text-primary-foreground";

              return (
                <motion.div
                  key={`${obj.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="absolute"
                  style={{
                    left: `${obj.bbox.x * 100}%`,
                    top: `${obj.bbox.y * 100}%`,
                    width: `${obj.bbox.w * 100}%`,
                    height: `${obj.bbox.h * 100}%`,
                  }}
                >
                  <div className={`w-full h-full border-[0.5px] ${borderColor} ${bgColor}`} />
                  {/* Label */}
                  <span
                    className={`absolute -top-5 left-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 tabular-nums whitespace-nowrap ${labelBg}`}
                  >
                    {obj.label} [{(obj.confidence * 100).toFixed(0)}%]
                  </span>
                  {/* Corner brackets */}
                  <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${borderColor}`} />
                  <div className={`absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 ${borderColor}`} />
                  <div className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 ${borderColor}`} />
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${borderColor}`} />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* HUD overlay */}
          {isRunning && (
            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-mono text-terminal-green/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-terminal-green" />
                </span>
                {detections.length} OBJ
              </div>
              <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-mono text-muted-foreground">
                {phase.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Scene summary */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sceneSummary || "empty"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs font-mono text-muted-foreground flex items-center gap-2"
          >
            <Eye className="h-3 w-3 shrink-0 text-terminal-green/50" />
            <span className="truncate">{sceneSummary || "Waiting for perception..."}</span>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

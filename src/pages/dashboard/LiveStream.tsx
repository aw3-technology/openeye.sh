import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
import { DetectionList } from "@/components/dashboard/DetectionList";
import { VLMReasoningPanel } from "@/components/dashboard/VLMReasoningPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Play,
  Square,
  Clock,
  Layers,
  Activity,
  Settings2,
  Maximize2,
  ChevronDown,
  Shield,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Safety Log                                                         */
/* ------------------------------------------------------------------ */

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

function SafetyLog({ isStreaming, objects }: {
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
      (o) => o.label.toLowerCase().includes("knife") || o.confidence < 0.5,
    );

    // Person proximity alerts
    for (const p of persons) {
      if (p.bbox.h > 0.6) {
        entries.push({
          id: ++safetyLogCounter,
          message: "Person in DANGER zone — too close",
          level: "danger",
          timestamp: ts,
        });
      } else if (p.bbox.h > 0.3) {
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

/* ------------------------------------------------------------------ */
/*  Model Settings Panel                                               */
/* ------------------------------------------------------------------ */

function ModelSettingsPanel() {
  const { modelParams, setModelParams } = useOpenEyeStream();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-foreground/5 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-terminal-amber" />
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                  Model Settings
                </CardTitle>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Confidence
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {(modelParams.confidence_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[modelParams.confidence_threshold]}
                min={0.1}
                max={0.95}
                step={0.05}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, confidence_threshold: v })
                }
              />
            </div>

            {/* NMS Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  NMS Threshold
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {(modelParams.nms_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[modelParams.nms_threshold]}
                min={0.1}
                max={0.9}
                step={0.05}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, nms_threshold: v })
                }
              />
            </div>

            {/* Max Detections */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Max Detections
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {modelParams.max_detections}
                </span>
              </div>
              <Slider
                value={[modelParams.max_detections]}
                min={10}
                max={300}
                step={10}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, max_detections: v })
                }
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Metrics Bar                                                        */
/* ------------------------------------------------------------------ */

function MetricsBar() {
  const { metrics, latestResult } = useOpenEyeStream();

  const overallSafety = useMemo(() => {
    if (!latestResult) return "safe";
    for (const obj of latestResult.objects) {
      if (obj.label.toLowerCase() === "person" && obj.bbox.h > 0.6) return "danger";
    }
    for (const obj of latestResult.objects) {
      if (obj.label.toLowerCase() === "person" && obj.bbox.h > 0.3) return "caution";
    }
    if (latestResult.objects.some((o) => o.label.toLowerCase().includes("knife") || o.confidence < 0.5))
      return "caution";
    return "safe";
  }, [latestResult]);

  const safetyColor =
    overallSafety === "danger"
      ? "text-red-400"
      : overallSafety === "caution"
        ? "text-terminal-amber"
        : "text-terminal-green";

  const stats = [
    {
      label: "FPS",
      value: String(metrics.fps),
      color:
        metrics.fps > 20
          ? "text-terminal-green"
          : metrics.fps > 10
            ? "text-terminal-amber"
            : "text-red-400",
    },
    {
      label: "Latency",
      value: `${metrics.latency_ms.toFixed(0)}ms`,
      color:
        metrics.latency_ms > 0 && metrics.latency_ms < 50
          ? "text-terminal-green"
          : metrics.latency_ms < 100
            ? "text-terminal-amber"
            : metrics.latency_ms > 0
              ? "text-red-400"
              : "text-foreground",
    },
    { label: "Objects", value: String(latestResult?.objects.length ?? 0) },
    { label: "Safety", value: overallSafety.toUpperCase(), color: safetyColor },
    { label: "Frames", value: String(metrics.frame_count) },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card/50 rounded-md border border-foreground/10 px-3 py-2 text-center"
        >
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </div>
          <div
            className={`font-mono text-sm tabular-nums font-semibold ${stat.color ?? "text-foreground"}`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main LiveStream Inner Component                                    */
/* ------------------------------------------------------------------ */

function LiveStreamInner() {
  const { isStreaming, startStream, stopStream, latestResult } = useOpenEyeStream();
  const { isConnected, healthData } = useOpenEyeConnection();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const objects = latestResult?.objects ?? [];

  return (
    <div className="space-y-4">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Live Stream</h1>
          {isStreaming && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green animate-pulse"
            >
              LIVE
            </Badge>
          )}
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-terminal-green" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-400" />
            )}
            <span className="hidden sm:inline">
              {isConnected
                ? healthData?.model ?? "connected"
                : "disconnected"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={isStreaming ? stopStream : handleStart}
            variant={isStreaming ? "destructive" : "default"}
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ---- Main Layout: 60/40 ---- */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left column: Camera Feed */}
        <div className="lg:col-span-3 space-y-4">
          <LiveCameraFeed />
          {/* Metrics bar below camera */}
          <MetricsBar />
        </div>

        {/* Right column: Intelligence Panels */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <DetectionList />
          <SafetyLog isStreaming={isStreaming} objects={objects} />
          <LiveSceneGraph objects={objects} />
        </div>
      </div>

      {/* ---- Bottom panels ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <VLMReasoningPanel />
        <ModelSettingsPanel />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported Page Component                                            */
/* ------------------------------------------------------------------ */

export default function LiveStream() {
  return (
    <OpenEyeStreamProvider>
      <LiveStreamInner />
    </OpenEyeStreamProvider>
  );
}

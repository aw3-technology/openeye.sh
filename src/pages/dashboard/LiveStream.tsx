import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
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
  Brain,
  Zap,
  Clock,
  Eye,
  Layers,
  Activity,
  Settings2,
  Maximize2,
  ChevronDown,
  Shield,
  Wifi,
  WifiOff,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { VLMReasoning } from "@/types/openeye";

/* ------------------------------------------------------------------ */
/*  Detection Timeline Sparkline                                       */
/* ------------------------------------------------------------------ */

const TIMELINE_LENGTH = 40;

function DetectionTimeline({ count }: { count: number }) {
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    historyRef.current = [...historyRef.current, count].slice(-TIMELINE_LENGTH);
  }, [count]);

  const points = historyRef.current;
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const h = 28;
  const w = 120;
  const step = w / (TIMELINE_LENGTH - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-60">
      <path d={d} fill="none" stroke="hsl(var(--terminal-green))" strokeWidth="1.5" />
    </svg>
  );
}

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
/*  VLM Reasoning Panel (with typewriter + history)                    */
/* ------------------------------------------------------------------ */

function VLMReasoningPanel() {
  const { videoRef, isStreaming } = useOpenEyeStream();
  const { latestReasoning, isActive, isPending, latencyMs, start, stop } = useVLMStream();
  const [displayText, setDisplayText] = useState("");
  const [history, setHistory] = useState<VLMReasoning[]>([]);
  const animRef = useRef<number | null>(null);
  const targetRef = useRef("");

  // Auto-start/stop VLM with main stream
  useEffect(() => {
    if (isStreaming && !isActive) start(videoRef);
    if (!isStreaming && isActive) stop();
  }, [isStreaming, isActive, start, stop, videoRef]);

  // Typewriter effect
  useEffect(() => {
    if (!latestReasoning?.description) return;
    const text = latestReasoning.description;

    setHistory((prev) => {
      const next = [latestReasoning, ...prev.filter((v) => v.description !== text)];
      return next.slice(0, 3);
    });

    targetRef.current = text;
    let charIndex = 0;
    setDisplayText("");

    const tick = () => {
      if (charIndex < targetRef.current.length) {
        charIndex += 2;
        setDisplayText(targetRef.current.slice(0, charIndex));
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [latestReasoning]);

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              VLM Reasoning
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[9px] font-mono border-purple-500/30 text-purple-400"
            >
              Dual-Layer
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                Thinking...
              </span>
            )}
            {latencyMs > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {(latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-xs leading-relaxed max-h-[220px] overflow-y-auto space-y-3">
          {!isStreaming ? (
            <p className="text-muted-foreground">Start camera to enable VLM reasoning.</p>
          ) : latestReasoning ? (
            <>
              {/* Current description with typewriter */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Scene
                  </span>
                </div>
                <div className="text-terminal-green bg-foreground/5 rounded-md p-2.5 border border-foreground/5">
                  {displayText}
                  {displayText.length < (targetRef.current?.length ?? 0) && (
                    <span className="inline-block w-1.5 h-3 bg-terminal-green animate-[cursor-blink_1s_step-end_infinite] ml-0.5" />
                  )}
                </div>
              </div>

              {/* Reasoning */}
              {latestReasoning.reasoning && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Reasoning
                    </span>
                  </div>
                  <p className="text-foreground/80 bg-foreground/5 rounded-md p-2.5 border border-foreground/5">
                    {latestReasoning.reasoning}
                  </p>
                </div>
              )}

              {/* History */}
              {history.slice(1).map((vlm, i) => (
                <motion.div
                  key={`hist-${i}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 0.25 - i * 0.08 }}
                  className="text-muted-foreground border-t border-foreground/5 pt-2"
                >
                  <span className="text-[10px] tabular-nums">
                    [{(vlm.latency_ms / 1000).toFixed(1)}s]
                  </span>{" "}
                  {vlm.description.slice(0, 100)}
                  {vlm.description.length > 100 ? "..." : ""}
                </motion.div>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
              Waiting for first VLM response...
            </div>
          )}

          {/* Pipeline info */}
          {isStreaming && (
            <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span>YOLO + VLM</span>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-mono border-blue-500/30 text-blue-400"
              >
                Nebius
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Metrics Bar                                                        */
/* ------------------------------------------------------------------ */

function MetricsBar() {
  const { metrics, latestResult } = useOpenEyeStream();

  const personCount =
    latestResult?.objects.filter((o) => o.label.toLowerCase() === "person").length ?? 0;

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
/*  Detection List                                                     */
/* ------------------------------------------------------------------ */

function DetectionList() {
  const { latestResult, isStreaming } = useOpenEyeStream();

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-terminal-green" />
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Detections
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {latestResult && latestResult.objects.length > 0 && (
              <>
                <DetectionTimeline count={latestResult.objects.length} />
                <Badge variant="outline" className="text-[9px] font-mono">
                  {latestResult.objects.length}
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!latestResult || latestResult.objects.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono py-3 text-center">
            {isStreaming ? "No objects detected yet..." : "Start camera to see detections."}
          </p>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
            {latestResult.objects.map((obj, i) => {
              const isPerson = obj.label.toLowerCase() === "person";
              const isHazard =
                obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
              const confidence = obj.confidence * 100;

              return (
                <div
                  key={`${obj.label}-${i}`}
                  className={`flex items-center justify-between font-mono text-[11px] py-1.5 px-2 rounded-md ${
                    isHazard
                      ? "bg-terminal-amber/5 border border-terminal-amber/10"
                      : isPerson
                        ? "bg-purple-500/5 border border-purple-500/10"
                        : "bg-foreground/5 border border-foreground/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isHazard
                          ? "bg-terminal-amber"
                          : isPerson
                            ? "bg-purple-400"
                            : "bg-terminal-green"
                      }`}
                    />
                    <span
                      className={
                        isHazard
                          ? "text-terminal-amber"
                          : isPerson
                            ? "text-purple-400"
                            : ""
                      }
                    >
                      {obj.label}
                    </span>
                    {isHazard && (
                      <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                        hazard
                      </span>
                    )}
                    {isPerson && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                        {obj.bbox.h > 0.6
                          ? "CLOSE"
                          : obj.bbox.h > 0.3
                            ? "MED"
                            : "FAR"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          confidence > 80
                            ? "bg-terminal-green"
                            : confidence > 50
                              ? "bg-terminal-amber"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground w-10 text-right text-[10px]">
                      {confidence.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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

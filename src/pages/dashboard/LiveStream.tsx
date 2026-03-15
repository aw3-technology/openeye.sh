import { useEffect } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, Brain, Zap, Clock, Eye, Layers, Activity } from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  VLM Reasoning Panel                                                */
/* ------------------------------------------------------------------ */

function VLMReasoningPanel() {
  const { videoRef, isStreaming } = useOpenEyeStream();
  const { latestReasoning, isActive, isPending, latencyMs, start, stop } = useVLMStream();

  // Auto-start VLM when the main stream starts, auto-stop when it stops
  useEffect(() => {
    if (isStreaming && !isActive) {
      start(videoRef);
    }
    if (!isStreaming && isActive) {
      stop();
    }
  }, [isStreaming, isActive, start, stop, videoRef]);

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <CardTitle className="text-sm">VLM Reasoning</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-purple-500/30 text-purple-400"
            >
              Dual-Layer Perception
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-blue-500/30 text-blue-400"
            >
              Nebius Token Factory
            </Badge>
            {isPending && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                Reasoning...
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isStreaming ? (
          <p className="text-sm text-muted-foreground font-mono">
            Start camera to enable VLM reasoning.
          </p>
        ) : !latestReasoning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
              <span className="font-mono text-xs">Waiting for first VLM response...</span>
            </div>
            <div className="h-16 rounded-md bg-foreground/5 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* VLM Description */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Scene Description
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 font-mono bg-foreground/5 rounded-md p-3 border border-foreground/5">
                {latestReasoning.description}
              </p>
            </div>

            {/* VLM Reasoning */}
            {latestReasoning.reasoning && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Reasoning
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 font-mono bg-foreground/5 rounded-md p-3 border border-foreground/5">
                  {latestReasoning.reasoning}
                </p>
              </div>
            )}

            {/* VLM Latency */}
            <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>VLM Latency:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    latencyMs < 2000 ? "text-terminal-green" : latencyMs < 5000 ? "text-terminal-amber" : "text-red-400"
                  }`}
                >
                  {latencyMs.toFixed(0)}ms
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span>Pipeline:</span>
                <span className="text-terminal-green font-semibold">YOLO + VLM</span>
              </div>
            </div>
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
  const { isStreaming, startStream, stopStream, metrics, latestResult } = useOpenEyeStream();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  const personCount = latestResult?.objects.filter(
    (o) => o.label.toLowerCase() === "person",
  ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Live Stream</h1>
          {isStreaming && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green animate-pulse"
            >
              STREAMING
            </Badge>
          )}
        </div>
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

      {/* ---- Camera Feed ---- */}
      <LiveCameraFeed />

      {/* ---- Metric Cards ---- */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-terminal-green" />
              <CardTitle className="text-xs text-muted-foreground">FPS</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                metrics.fps > 20
                  ? "text-terminal-green"
                  : metrics.fps > 10
                    ? "text-terminal-amber"
                    : "text-red-400"
              }`}
            >
              {metrics.fps}
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-terminal-amber" />
              <CardTitle className="text-xs text-muted-foreground">Latency</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                metrics.latency_ms > 0 && metrics.latency_ms < 50
                  ? "text-terminal-green"
                  : metrics.latency_ms < 100
                    ? "text-terminal-amber"
                    : metrics.latency_ms > 0
                      ? "text-red-400"
                      : ""
              }`}
            >
              {metrics.latency_ms.toFixed(0)}
              <span className="text-sm text-muted-foreground ml-0.5">ms</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-purple-400" />
              <CardTitle className="text-xs text-muted-foreground">Objects</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {latestResult?.objects.length ?? 0}
            </p>
            {personCount > 0 && (
              <p className="text-[10px] font-mono text-terminal-amber mt-0.5">
                {personCount} person{personCount > 1 ? "s" : ""} detected
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <CardTitle className="text-xs text-muted-foreground">Frames</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{metrics.frame_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Detection List + Scene Graph (two-column on desktop) ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: Detection List */}
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-terminal-green" />
                <CardTitle className="text-sm">Live Detections</CardTitle>
              </div>
              {latestResult && latestResult.objects.length > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {latestResult.objects.length} detected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!latestResult || latestResult.objects.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono py-4 text-center">
                {isStreaming ? "No objects detected yet..." : "Start camera to see detections."}
              </p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {latestResult.objects.map((obj, i) => {
                  const isPerson = obj.label.toLowerCase() === "person";
                  const isHazard = obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
                  const confidence = obj.confidence * 100;

                  return (
                    <div
                      key={`${obj.label}-${i}`}
                      className={`flex items-center justify-between font-mono text-xs py-1.5 px-2 rounded-md ${
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
                            isHazard ? "bg-terminal-amber" : isPerson ? "bg-purple-400" : "bg-terminal-green"
                          }`}
                        />
                        <span className={isHazard ? "text-terminal-amber" : isPerson ? "text-purple-400" : ""}>
                          {obj.label}
                        </span>
                        {isHazard && (
                          <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                            hazard
                          </span>
                        )}
                        {isPerson && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                            {obj.bbox.h > 0.6 ? "CLOSE" : obj.bbox.h > 0.3 ? "MED" : "FAR"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Confidence bar */}
                        <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
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
                        <span className="tabular-nums text-muted-foreground w-12 text-right">
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

        {/* Right column: Scene Graph */}
        <div>
          <LiveSceneGraph objects={latestResult?.objects ?? []} />
        </div>
      </div>

      {/* ---- VLM Reasoning Panel ---- */}
      <VLMReasoningPanel />
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

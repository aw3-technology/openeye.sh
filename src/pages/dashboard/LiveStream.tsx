import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
import { LiveStreamVLMPanel } from "@/components/dashboard/LiveStreamVLMPanel";
import { DetectionList } from "@/components/dashboard/DetectionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, Zap, Eye, Layers, Activity } from "lucide-react";
import { toast } from "sonner";

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
      {/* Header */}
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

      {/* Camera Feed */}
      <LiveCameraFeed />

      {/* Metric Cards */}
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

      {/* Detection List + Scene Graph */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DetectionList
          objects={latestResult?.objects ?? []}
          isStreaming={isStreaming}
        />
        <div>
          <LiveSceneGraph objects={latestResult?.objects ?? []} />
        </div>
      </div>

      {/* VLM Reasoning Panel */}
      <LiveStreamVLMPanel />
    </div>
  );
}

export default function LiveStream() {
  return <LiveStreamInner />;
}

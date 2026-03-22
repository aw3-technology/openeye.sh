import { useState, useEffect, useRef, useMemo } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  BarChart3,
  Eye,
  Gauge,
  Layers,
  Play,
  Square,
  Timer,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { computeStats, formatDuration } from "./metrics/types";
import type { DataPoint } from "./metrics/types";
import { FpsChart, LatencyChart, DetectionsChart, FramesChart } from "./metrics/MetricsCharts";
import { SessionStatsCard } from "./metrics/SessionStatsCard";
import { DetectionList } from "./metrics/DetectionList";

function MetricsInner() {
  const { isStreaming, latestResult, startStream, stopStream, metrics } = useOpenEyeStream();
  const { isConnected, healthData } = useOpenEyeConnection();
  const [history, setHistory] = useState<DataPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const metricsRef = useRef(metrics);
  const resultRef = useRef(latestResult);
  metricsRef.current = metrics;
  resultRef.current = latestResult;

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  // Collect data points every second while streaming
  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => {
      const m = metricsRef.current;
      const r = resultRef.current;
      setHistory((prev) => {
        const point: DataPoint = {
          time: Math.round((Date.now() - startTime.current) / 1000),
          fps: m.fps,
          latency: m.latency_ms,
          frames: m.frame_count,
          detections: r?.objects?.length ?? 0,
        };
        const next = [...prev, point];
        return next.length > 120 ? next.slice(-120) : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Reset on stream start
  useEffect(() => {
    if (isStreaming) {
      startTime.current = Date.now();
      setHistory([]);
      setElapsed(0);
    }
  }, [isStreaming]);

  // Uptime counter
  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  const stats = useMemo(() => computeStats(history), [history]);

  const hasData = history.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-terminal-green" />
          <div>
            <h1 className="text-2xl font-semibold">Performance Metrics</h1>
            <p className="text-sm text-muted-foreground">
              Real-time inference pipeline telemetry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isStreaming && (
            <Badge variant="outline" className="gap-1.5 font-mono text-xs text-terminal-green border-terminal-green/30">
              <span className="h-1.5 w-1.5 rounded-full bg-terminal-green animate-pulse" />
              LIVE
            </Badge>
          )}
          {healthData?.model && (
            <Badge variant="outline" className="font-mono text-xs">
              {healthData.model}
            </Badge>
          )}
          <Button
            onClick={isStreaming ? stopStream : handleStart}
            variant={isStreaming ? "destructive" : "default"}
            size="sm"
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Square className="h-3.5 w-3.5" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Live KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Current FPS"
          value={isStreaming ? metrics.fps : hasData ? stats.avgFps : "—"}
          icon={Activity}
          color={isStreaming ? (metrics.fps >= 20 ? "bg-green-500/15 text-green-500" : metrics.fps >= 10 ? "bg-yellow-500/15 text-yellow-500" : "bg-red-500/15 text-red-500") : "bg-muted"}
          description={hasData ? `avg ${stats.avgFps}` : undefined}
        />
        <MetricCard
          label="Latency"
          value={isStreaming ? `${metrics.latency_ms}ms` : hasData ? `${stats.avgLatency}ms` : "—"}
          icon={Zap}
          color={isStreaming ? (metrics.latency_ms <= 50 ? "bg-green-500/15 text-green-500" : metrics.latency_ms <= 150 ? "bg-yellow-500/15 text-yellow-500" : "bg-red-500/15 text-red-500") : "bg-muted"}
          description={hasData ? `p95 ${stats.p95Latency}ms` : undefined}
        />
        <MetricCard
          label="Frames"
          value={metrics.frame_count || (hasData ? history[history.length - 1].frames : "—")}
          icon={Layers}
          color="bg-blue-500/15 text-blue-500"
        />
        <MetricCard
          label="Detections"
          value={latestResult?.objects?.length ?? (hasData ? "—" : "—")}
          icon={Eye}
          color="bg-purple-500/15 text-purple-500"
          description={hasData ? `${stats.totalDetections} total` : undefined}
        />
        <MetricCard
          label="Session"
          value={isStreaming ? formatDuration(elapsed) : hasData ? formatDuration(history[history.length - 1].time) : "—"}
          icon={Timer}
          color="bg-teal-500/15 text-teal-500"
          description={isConnected ? "Connected" : "Offline"}
        />
      </div>

      {/* Empty state */}
      {!isStreaming && !hasData && (
        <Card>
          <CardContent className="py-12 text-center">
            <Gauge className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Start streaming to capture real-time performance data.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Charts will populate with FPS, latency, and detection metrics as frames are processed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts & stats */}
      {hasData && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <FpsChart history={history} stats={stats} />
            <LatencyChart history={history} stats={stats} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <DetectionsChart history={history} />
            <FramesChart history={history} />
          </div>
          <SessionStatsCard
            stats={stats}
            history={history}
            isStreaming={isStreaming}
            elapsed={elapsed}
            currentDetections={latestResult?.objects?.length ?? 0}
          />
          {latestResult && latestResult.objects.length > 0 && (
            <DetectionList objects={latestResult.objects} />
          )}
        </>
      )}
    </div>
  );
}

export default function Metrics() {
  return (
    <OpenEyeStreamProvider>
      <MetricsInner />
    </OpenEyeStreamProvider>
  );
}

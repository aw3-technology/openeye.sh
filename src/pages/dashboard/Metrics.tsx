import { useState, useEffect, useRef, useMemo } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  BarChart3,
  Clock,
  Cpu,
  Eye,
  Gauge,
  Layers,
  Play,
  Square,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  time: number;
  fps: number;
  latency: number;
  frames: number;
  detections: number;
}

interface SessionStats {
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  totalDetections: number;
}

const chartColors = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  green: "hsl(var(--terminal-green))",
  amber: "hsl(var(--terminal-amber))",
  primary: "hsl(var(--primary))",
  red: "hsl(0 72% 51%)",
  blue: "hsl(217 91% 60%)",
} as const;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  borderRadius: 6,
};

function fpsColor(fps: number): string {
  if (fps >= 20) return "text-terminal-green";
  if (fps >= 10) return "text-terminal-amber";
  return "text-red-400";
}

function latencyColor(ms: number): string {
  if (ms <= 50) return "text-terminal-green";
  if (ms <= 150) return "text-terminal-amber";
  return "text-red-400";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function computeStats(history: DataPoint[]): SessionStats {
  if (history.length === 0) {
    return { avgFps: 0, minFps: 0, maxFps: 0, avgLatency: 0, minLatency: 0, maxLatency: 0, p95Latency: 0, totalDetections: 0 };
  }

  const fpsValues = history.map((p) => p.fps);
  const latValues = history.map((p) => p.latency).filter((l) => l > 0);
  const sortedLat = [...latValues].sort((a, b) => a - b);

  return {
    avgFps: Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length),
    minFps: Math.min(...fpsValues),
    maxFps: Math.max(...fpsValues),
    avgLatency: latValues.length > 0 ? Math.round(latValues.reduce((a, b) => a + b, 0) / latValues.length) : 0,
    minLatency: latValues.length > 0 ? Math.round(Math.min(...latValues)) : 0,
    maxLatency: latValues.length > 0 ? Math.round(Math.max(...latValues)) : 0,
    p95Latency: sortedLat.length > 0 ? Math.round(sortedLat[Math.floor(sortedLat.length * 0.95)]) : 0,
    totalDetections: history.reduce((sum, p) => sum + p.detections, 0),
  };
}

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

      {/* Main charts */}
      {hasData && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* FPS chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-terminal-green" />
                    FPS Over Time
                  </span>
                  {hasData && (
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {stats.minFps}–{stats.maxFps} range
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      stroke={chartColors.axis}
                      label={{ value: "sec", position: "insideBottomRight", offset: -5, fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} domain={[0, "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {stats.avgFps > 0 && (
                      <ReferenceLine
                        y={stats.avgFps}
                        stroke={chartColors.green}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="fps"
                      stroke={chartColors.green}
                      dot={false}
                      strokeWidth={1.5}
                      name="FPS"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Latency chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-terminal-amber" />
                    Inference Latency
                  </span>
                  {hasData && (
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      avg {stats.avgLatency}ms
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      stroke={chartColors.axis}
                      label={{ value: "sec", position: "insideBottomRight", offset: -5, fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} unit="ms" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}ms`, "Latency"]} />
                    {stats.avgLatency > 0 && (
                      <ReferenceLine
                        y={stats.avgLatency}
                        stroke={chartColors.amber}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="latency"
                      stroke={chartColors.amber}
                      fill={chartColors.amber}
                      fillOpacity={0.1}
                      dot={false}
                      strokeWidth={1.5}
                      name="Latency"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: Detections + Frame throughput */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Object detections chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-purple-500" />
                  Objects Detected Per Frame
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke={chartColors.axis} />
                    <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="detections"
                      fill="hsl(270 70% 60%)"
                      fillOpacity={0.7}
                      radius={[2, 2, 0, 0]}
                      name="Detections"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Frame count chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Cumulative Frames
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke={chartColors.axis} />
                    <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="frames"
                      stroke={chartColors.blue}
                      fill={chartColors.blue}
                      fillOpacity={0.1}
                      dot={false}
                      strokeWidth={1.5}
                      name="Frames"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Session Statistics Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-terminal-green" />
                Session Statistics
                {isStreaming && (
                  <Badge variant="outline" className="ml-auto text-xs font-mono tabular-nums">
                    {formatDuration(elapsed)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* FPS stats */}
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Frames Per Second
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${fpsColor(stats.minFps)}`}>
                        {stats.minFps}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${fpsColor(stats.avgFps)}`}>
                        {stats.avgFps}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${fpsColor(stats.maxFps)}`}>
                        {stats.maxFps}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Latency stats */}
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Latency (ms)
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${latencyColor(stats.minLatency)}`}>
                        {stats.minLatency}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${latencyColor(stats.avgLatency)}`}>
                        {stats.avgLatency}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">P95</p>
                      <p className={`text-sm font-semibold tabular-nums font-mono ${latencyColor(stats.p95Latency)}`}>
                        {stats.p95Latency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Throughput */}
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Throughput
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Frames</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {history.length > 0 ? history[history.length - 1].frames : 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Samples</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {history.length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detection stats */}
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> Detections
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {latestResult?.objects?.length ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {stats.totalDetections}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live detection list */}
          {latestResult && latestResult.objects.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5" />
                    Current Detections
                  </span>
                  <Badge variant="secondary" className="tabular-nums text-xs">
                    {latestResult.objects.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {latestResult.objects.map((obj, i) => (
                    <div
                      key={`${obj.label}-${i}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="text-sm font-medium truncate">{obj.label}</span>
                      <Badge
                        variant="outline"
                        className={`tabular-nums text-xs font-mono ${
                          obj.confidence >= 0.8
                            ? "text-terminal-green border-terminal-green/30"
                            : obj.confidence >= 0.5
                              ? "text-terminal-amber border-terminal-amber/30"
                              : "text-red-400 border-red-400/30"
                        }`}
                      >
                        {(obj.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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

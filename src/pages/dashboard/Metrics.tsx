import { useState, useEffect, useRef } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface DataPoint {
  time: number;
  fps: number;
  latency: number;
  frames: number;
}

const chartColors = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  green: "hsl(var(--terminal-green))",
  amber: "hsl(var(--terminal-amber))",
  primary: "hsl(var(--primary))",
} as const;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
};

function MetricsInner() {
  const { isStreaming, startStream, stopStream, metrics } = useOpenEyeStream();
  const [history, setHistory] = useState<DataPoint[]>([]);
  const startTime = useRef(Date.now());
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => {
      const m = metricsRef.current;
      setHistory((prev) => {
        const point: DataPoint = {
          time: Math.round((Date.now() - startTime.current) / 1000),
          fps: m.fps,
          latency: m.latency_ms,
          frames: m.frame_count,
        };
        const next = [...prev, point];
        return next.length > 120 ? next.slice(-120) : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      startTime.current = Date.now();
      setHistory([]);
    }
  }, [isStreaming]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Performance Metrics</h1>
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
              Start Streaming
            </>
          )}
        </Button>
      </div>

      {!isStreaming && history.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Start streaming to see real-time performance metrics.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">FPS Over Time</CardTitle>
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
                <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="fps"
                  stroke={chartColors.green}
                  dot={false}
                  strokeWidth={1.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Inference Latency (ms)</CardTitle>
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
                <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke={chartColors.amber}
                  fill={chartColors.amber}
                  fillOpacity={0.1}
                  dot={false}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Frame Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                stroke={chartColors.axis}
              />
              <YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="frames"
                stroke={chartColors.primary}
                fill={chartColors.primary}
                fillOpacity={0.1}
                dot={false}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Metrics() {
  return <MetricsInner />;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Eye, Gauge, Layers, Zap } from "lucide-react";
import type { DataPoint, SessionStats } from "./types";
import { fpsColor, latencyColor, formatDuration } from "./types";

interface SessionStatsCardProps {
  stats: SessionStats;
  history: DataPoint[];
  isStreaming: boolean;
  elapsed: number;
  currentDetections: number;
}

export function SessionStatsCard({ stats, history, isStreaming, elapsed, currentDetections }: SessionStatsCardProps) {
  return (
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
                  {currentDetections}
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
  );
}

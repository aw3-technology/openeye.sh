import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Eye, Layers, Zap } from "lucide-react";
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
import { chartColors, tooltipStyle } from "../chart-constants";
import type { DataPoint, SessionStats } from "./types";

interface ChartsProps {
  history: DataPoint[];
  stats: SessionStats;
}

export function FpsChart({ history, stats }: ChartsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-terminal-green" />
            FPS Over Time
          </span>
          {history.length > 0 && (
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
  );
}

export function LatencyChart({ history, stats }: ChartsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-terminal-amber" />
            Inference Latency
          </span>
          {history.length > 0 && (
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
  );
}

export function DetectionsChart({ history }: { history: DataPoint[] }) {
  return (
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
  );
}

export function FramesChart({ history }: { history: DataPoint[] }) {
  return (
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
  );
}

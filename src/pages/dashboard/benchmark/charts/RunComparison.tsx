import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { chartColors, tooltipStyle } from "../../chart-constants";
import type { BenchmarkResult } from "../types";

export function RunComparison({ results }: { results: BenchmarkResult[] }) {
  const data = [...results].reverse().map((r, i) => ({
    name: `#${i + 1}`,
    mean: r.mean_ms,
    median: r.median_ms,
    p95: r.p95_ms,
    fps: r.fps,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Latency Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                stroke={chartColors.axis}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke={chartColors.axis}
                label={{
                  value: "ms",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 10,
                }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="mean"
                stroke={chartColors.green}
                strokeWidth={2}
                dot
                name="Mean"
              />
              <Line
                type="monotone"
                dataKey="median"
                stroke={chartColors.primary}
                strokeWidth={2}
                dot
                name="Median"
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke={chartColors.amber}
                strokeWidth={2}
                dot
                name="P95"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Throughput Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                stroke={chartColors.axis}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke={chartColors.axis}
                label={{
                  value: "FPS",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 10,
                }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="fps"
                fill={chartColors.green}
                fillOpacity={0.7}
                radius={[4, 4, 0, 0]}
                name="FPS"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

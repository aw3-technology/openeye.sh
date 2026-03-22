import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { chartColors, tooltipStyle } from "../../chart-constants";
import type { BenchmarkResult } from "../types";

export function LatencyTimeline({ result }: { result: BenchmarkResult }) {
  const data = result.latencies.map((l, i) => ({
    run: i + 1,
    latency: l,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Latency Per Run</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="run"
              tick={{ fontSize: 10 }}
              stroke={chartColors.axis}
              label={{
                value: "run #",
                position: "insideBottomRight",
                offset: -5,
                fontSize: 10,
              }}
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
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value.toFixed(2)} ms`, "Latency"]}
            />
            <ReferenceLine
              y={result.mean_ms}
              stroke={chartColors.green}
              strokeDasharray="3 3"
              label={{ value: "mean", fontSize: 10, fill: chartColors.green }}
            />
            <ReferenceLine
              y={result.p95_ms}
              stroke={chartColors.amber}
              strokeDasharray="3 3"
              label={{ value: "p95", fontSize: 10, fill: chartColors.amber }}
            />
            <Area
              type="monotone"
              dataKey="latency"
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
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { chartColors, tooltipStyle } from "../../chart-constants";
import type { BenchmarkResult } from "../types";

export function LatencyScatter({ result }: { result: BenchmarkResult }) {
  const data = result.latencies.map((l, i) => ({
    run: i + 1,
    latency: l,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Latency Scatter Plot</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="run"
              type="number"
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
              dataKey="latency"
              type="number"
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
            />
            <ReferenceLine
              y={result.p95_ms}
              stroke={chartColors.amber}
              strokeDasharray="3 3"
            />
            <Scatter data={data} fill={chartColors.primary} fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

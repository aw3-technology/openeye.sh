import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { chartColors, tooltipStyle } from "../../chart-constants";
import type { BenchmarkResult } from "../types";
import { getLatencyColor } from "../types";

export function LatencyDistribution({ result }: { result: BenchmarkResult }) {
  const { latencies, mean_ms, p95_ms } = result;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const bucketCount = Math.min(20, Math.ceil(latencies.length / 2));
  const bucketSize = (max - min) / bucketCount || 1;

  const buckets: { range: string; count: number; from: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const from = min + i * bucketSize;
    const to = from + bucketSize;
    buckets.push({
      range: `${from.toFixed(0)}`,
      count: latencies.filter((l) => l >= from && (i === bucketCount - 1 ? l <= to : l < to)).length,
      from,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Latency Distribution ({result.runs} runs)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10 }}
              stroke={chartColors.axis}
              label={{
                value: "ms",
                position: "insideBottomRight",
                offset: -5,
                fontSize: 10,
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke={chartColors.axis}
              label={{
                value: "count",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value} runs`, "Count"]}
              labelFormatter={(label) => `${label} ms`}
            />
            <ReferenceLine
              x={buckets.find((b) => b.from <= mean_ms && b.from + bucketSize > mean_ms)?.range}
              stroke={chartColors.green}
              strokeDasharray="3 3"
              label={{ value: "mean", fontSize: 10, fill: chartColors.green }}
            />
            <ReferenceLine
              x={buckets.find((b) => b.from <= p95_ms && b.from + bucketSize > p95_ms)?.range}
              stroke={chartColors.amber}
              strokeDasharray="3 3"
              label={{ value: "p95", fontSize: 10, fill: chartColors.amber }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell
                  key={i}
                  fill={getLatencyColor(b.from + bucketSize / 2, mean_ms)}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

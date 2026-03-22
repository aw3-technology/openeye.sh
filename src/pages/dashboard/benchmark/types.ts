import { chartColors } from "../chart-constants";

export interface BenchmarkResult {
  id: string;
  model: string;
  runs: number;
  width: number;
  height: number;
  mean_ms: number;
  median_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
  std_ms: number;
  fps: number;
  latencies: number[];
  timestamp: string;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function stdDev(values: number[], mean: number) {
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function getLatencyColor(ms: number, mean: number) {
  if (ms <= mean * 0.8) return chartColors.green;
  if (ms <= mean * 1.2) return chartColors.amber;
  return "hsl(var(--destructive))";
}

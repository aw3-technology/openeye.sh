import { useState, useRef, useCallback } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gauge,
  Play,
  Loader2,
  Terminal,
  Clock,
  Zap,
  BarChart3,
  Trash2,
  Copy,
  Download,
  TrendingDown,
  TrendingUp,
  Activity,
  Timer,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
  ScatterChart,
  Scatter,
} from "recharts";

interface BenchmarkResult {
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

const chartColors = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  green: "hsl(var(--terminal-green))",
  amber: "hsl(var(--terminal-amber))",
  primary: "hsl(var(--primary))",
  muted: "hsl(var(--muted-foreground))",
} as const;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  fontFamily: "monospace",
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stdDev(values: number[], mean: number) {
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function getLatencyColor(ms: number, mean: number) {
  if (ms <= mean * 0.8) return chartColors.green;
  if (ms <= mean * 1.2) return chartColors.amber;
  return "hsl(var(--destructive))";
}

export default function Benchmark() {
  const { isConnected, healthData, client } = useOpenEyeConnection();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [runs, setRuns] = useState(20);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(480);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const runBenchmark = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect to an OpenEye server first");
      return;
    }

    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    setProgressLabel("Generating test image...");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      // Draw a more realistic test scene
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(0, 0, width, height);
      // Simulated objects at different scales
      ctx.fillStyle = "#666";
      ctx.fillRect(width * 0.1, height * 0.2, width * 0.25, height * 0.6);
      ctx.fillStyle = "#888";
      ctx.fillRect(width * 0.5, height * 0.3, width * 0.2, height * 0.5);
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(width * 0.8, height * 0.4, width * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Add noise-like texture
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.1)`;
        ctx.fillRect(
          Math.random() * width,
          Math.random() * height,
          Math.random() * 20 + 5,
          Math.random() * 20 + 5,
        );
      }

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9),
      );
      const file = new File([blob], "benchmark.jpg", { type: "image/jpeg" });

      // Warmup
      const warmupRuns = Math.min(3, Math.ceil(runs * 0.1));
      setProgressLabel(`Warming up (${warmupRuns} iterations)...`);
      for (let i = 0; i < warmupRuns; i++) {
        if (cancelRef.current) return;
        await client.predict(file);
        setProgress(((i + 1) / warmupRuns) * 10);
      }

      // Benchmark
      const latencies: number[] = [];
      for (let i = 0; i < runs; i++) {
        if (cancelRef.current) return;
        setProgressLabel(`Run ${i + 1} / ${runs}`);
        const start = performance.now();
        await client.predict(file);
        latencies.push(performance.now() - start);
        setProgress(10 + ((i + 1) / runs) * 90);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      const result: BenchmarkResult = {
        id: crypto.randomUUID(),
        model: healthData?.model || "unknown",
        runs,
        width,
        height,
        mean_ms: round2(mean),
        median_ms: round2(median),
        p95_ms: round2(p95),
        p99_ms: round2(p99),
        min_ms: round2(sorted[0]),
        max_ms: round2(sorted[sorted.length - 1]),
        std_ms: round2(stdDev(latencies, mean)),
        fps: Math.round((1000 / mean) * 10) / 10,
        latencies: latencies.map((l) => round2(l)),
        timestamp: new Date().toISOString(),
      };

      setResults((prev) => [result, ...prev]);
      setSelectedResult(result.id);
      toast.success(
        `Benchmark complete: ${result.mean_ms.toFixed(1)}ms mean (${result.fps} FPS)`,
      );
    } catch (err) {
      if (!cancelRef.current) {
        toast.error(
          `Benchmark failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    } finally {
      setRunning(false);
      setProgress(0);
      setProgressLabel("");
    }
  }, [isConnected, client, healthData, runs, width, height]);

  const cancelBenchmark = () => {
    cancelRef.current = true;
    setRunning(false);
    setProgress(0);
    setProgressLabel("");
    toast.info("Benchmark cancelled");
  };

  const clearResults = () => {
    setResults([]);
    setSelectedResult(null);
  };

  const exportResults = () => {
    const data = results.map(({ latencies: _l, ...rest }) => rest);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openeye-benchmark-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Results exported");
  };

  const copyResults = () => {
    const selected = results.find((r) => r.id === selectedResult) ?? results[0];
    if (!selected) return;
    const text = [
      `OpenEye Benchmark — ${selected.model}`,
      `${selected.runs} runs @ ${selected.width}x${selected.height}`,
      `Mean: ${selected.mean_ms}ms | Median: ${selected.median_ms}ms`,
      `P95: ${selected.p95_ms}ms | P99: ${selected.p99_ms}ms`,
      `Min: ${selected.min_ms}ms | Max: ${selected.max_ms}ms`,
      `Std Dev: ${selected.std_ms}ms | FPS: ${selected.fps}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const active = results.find((r) => r.id === selectedResult) ?? results[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-terminal-amber" />
          <h1 className="text-2xl font-semibold">Benchmark</h1>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && healthData?.model && (
            <Badge variant="outline" className="font-mono text-xs">
              {healthData.model}
            </Badge>
          )}
          {results.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={copyResults} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={exportResults} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="ghost" size="sm" onClick={clearResults} className="gap-1.5 text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Measure end-to-end inference latency by sending synthetic test images to
        the connected server. Results include network round-trip time. For
        hardware-level measurements, use{" "}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          openeye bench
        </code>{" "}
        from the CLI.
      </p>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="bench-runs">Iterations</Label>
              <Input
                id="bench-runs"
                type="number"
                value={runs}
                onChange={(e) =>
                  setRuns(
                    Math.max(1, Math.min(200, Number(e.target.value) || 20)),
                  )
                }
                min={1}
                max={200}
                disabled={running}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bench-width">Width (px)</Label>
              <Input
                id="bench-width"
                type="number"
                value={width}
                onChange={(e) =>
                  setWidth(
                    Math.max(64, Math.min(1920, Number(e.target.value) || 640)),
                  )
                }
                min={64}
                max={1920}
                disabled={running}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bench-height">Height (px)</Label>
              <Input
                id="bench-height"
                type="number"
                value={height}
                onChange={(e) =>
                  setHeight(
                    Math.max(64, Math.min(1080, Number(e.target.value) || 480)),
                  )
                }
                min={64}
                max={1080}
                disabled={running}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={running ? cancelBenchmark : runBenchmark}
                disabled={!running && !isConnected}
                variant={running ? "destructive" : "default"}
                className="w-full gap-2"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Benchmark
                  </>
                )}
              </Button>
            </div>
          </div>

          {running && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {!isConnected && !running && (
            <p className="mt-3 text-xs text-muted-foreground">
              Connect to an OpenEye server to run benchmarks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results Detail */}
      {active && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Mean"
              value={`${active.mean_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="Median"
              value={`${active.median_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="P95"
              value={`${active.p95_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Timer className="h-3.5 w-3.5" />}
              label="P99"
              value={`${active.p99_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<TrendingDown className="h-3.5 w-3.5 text-terminal-green" />}
              label="Min"
              value={`${active.min_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<TrendingUp className="h-3.5 w-3.5 text-destructive" />}
              label="Max"
              value={`${active.max_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<ArrowUpDown className="h-3.5 w-3.5" />}
              label="Std Dev"
              value={`${active.std_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Zap className="h-3.5 w-3.5 text-terminal-green" />}
              label="FPS"
              value={`${active.fps}`}
              highlight
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="distribution">
            <TabsList>
              <TabsTrigger value="distribution">Latency Distribution</TabsTrigger>
              <TabsTrigger value="timeline">Run Timeline</TabsTrigger>
              <TabsTrigger value="scatter">Scatter</TabsTrigger>
              {results.length > 1 && (
                <TabsTrigger value="compare">Compare Runs</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="distribution" className="mt-4">
              <LatencyDistribution result={active} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <LatencyTimeline result={active} />
            </TabsContent>

            <TabsContent value="scatter" className="mt-4">
              <LatencyScatter result={active} />
            </TabsContent>

            {results.length > 1 && (
              <TabsContent value="compare" className="mt-4">
                <RunComparison results={results} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      {/* Run History */}
      {results.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Run History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResult(r.id)}
                  className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                    r.id === active?.id
                      ? "border-terminal-green/30 bg-terminal-green/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.model}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.runs} runs &middot; {r.width}x{r.height}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>
                      {r.mean_ms.toFixed(1)} ms
                    </span>
                    <span className="text-terminal-green font-semibold">
                      {r.fps} FPS
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLI Equivalent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            CLI Equivalent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block text-xs font-mono bg-secondary text-oe-green px-3 py-2 rounded">
            $ openeye bench yolov8 --runs {runs} --width {width} --height{" "}
            {height}
          </code>
          <p className="text-xs text-muted-foreground">
            The CLI benchmark runs locally without network overhead, providing
            more accurate hardware-level measurements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p
          className={`text-sm font-semibold tabular-nums font-mono ${
            highlight ? "text-terminal-green" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function LatencyDistribution({ result }: { result: BenchmarkResult }) {
  // Build histogram buckets
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

function LatencyTimeline({ result }: { result: BenchmarkResult }) {
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

function LatencyScatter({ result }: { result: BenchmarkResult }) {
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

function RunComparison({ results }: { results: BenchmarkResult[] }) {
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

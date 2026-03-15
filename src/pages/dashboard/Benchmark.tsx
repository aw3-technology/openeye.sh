import { useState } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Gauge,
  Play,
  Loader2,
  Terminal,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface BenchmarkResult {
  model: string;
  runs: number;
  mean_ms: number;
  median_ms: number;
  p95_ms: number;
  fps: number;
  timestamp: string;
}

export default function Benchmark() {
  const { isConnected, healthData, client } = useOpenEyeConnection();
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(10);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(480);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  const runBenchmark = async () => {
    if (!isConnected) {
      toast.error("Connect to an OpenEye server first");
      return;
    }

    setRunning(true);

    try {
      // Create a synthetic test image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, width, height);
      // Draw some shapes for the detector
      ctx.fillStyle = "#888";
      ctx.fillRect(100, 100, 200, 300);
      ctx.fillStyle = "#aaa";
      ctx.fillRect(400, 150, 150, 250);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9),
      );
      const file = new File([blob], "benchmark.jpg", { type: "image/jpeg" });

      const latencies: number[] = [];

      // Warmup (3 runs)
      for (let i = 0; i < 3; i++) {
        await client.predict(file);
      }

      // Benchmark runs
      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        await client.predict(file);
        latencies.push(performance.now() - start);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];

      const result: BenchmarkResult = {
        model: healthData?.model || "unknown",
        runs,
        mean_ms: Math.round(mean * 100) / 100,
        median_ms: Math.round(median * 100) / 100,
        p95_ms: Math.round(p95 * 100) / 100,
        fps: Math.round((1000 / mean) * 10) / 10,
        timestamp: new Date().toISOString(),
      };

      setResults((prev) => [result, ...prev]);
      toast.success(
        `Benchmark complete: ${result.mean_ms.toFixed(1)}ms mean (${result.fps} FPS)`,
      );
    } catch (err) {
      toast.error(
        `Benchmark failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-terminal-amber" />
          <h1 className="text-2xl font-semibold">Benchmark</h1>
        </div>
        {isConnected && healthData?.model && (
          <Badge
            variant="outline"
            className="font-mono text-xs"
          >
            Model: {healthData.model}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Measure inference latency by sending test images to the connected
        server. For CLI benchmarking, use{" "}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          openeye bench
        </code>
        .
      </p>

      {/* Benchmark Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bench-runs">Iterations</Label>
              <Input
                id="bench-runs"
                type="number"
                value={runs}
                onChange={(e) =>
                  setRuns(Math.max(1, Math.min(100, Number(e.target.value) || 10)))
                }
                min={1}
                max={100}
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
              />
            </div>
          </div>

          <Button
            onClick={runBenchmark}
            disabled={running || !isConnected}
            className="mt-4 gap-2"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? "Running..." : "Run Benchmark"}
          </Button>

          {!isConnected && (
            <p className="mt-2 text-xs text-muted-foreground">
              Connect to an OpenEye server to run benchmarks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((r, i) => (
              <div
                key={r.timestamp}
                className={`rounded-md border p-4 space-y-3 ${i === 0 ? "border-terminal-green/30 bg-terminal-green/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.model}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.runs} runs
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mean</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {r.mean_ms.toFixed(1)} ms
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Median</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {r.median_ms.toFixed(1)} ms
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">P95</p>
                      <p className="text-sm font-semibold tabular-nums font-mono">
                        {r.p95_ms.toFixed(1)} ms
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-terminal-green" />
                    <div>
                      <p className="text-xs text-muted-foreground">FPS</p>
                      <p className="text-sm font-semibold tabular-nums font-mono text-terminal-green">
                        {r.fps}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
          <div className="space-y-2">
            <code className="block text-xs font-mono bg-secondary text-oe-green px-3 py-2 rounded">
              $ openeye bench yolov8 --runs {runs} --width {width} --height{" "}
              {height}
            </code>
            <p className="text-xs text-muted-foreground">
              The CLI benchmark runs locally without network overhead, providing
              more accurate hardware-level measurements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { BenchmarkResult } from "./types";
import { round2, stdDev } from "./types";

interface UseBenchmarkOptions {
  isConnected: boolean;
  client: { predict: (file: File) => Promise<unknown> };
  model: string | undefined;
}

export function useBenchmark({ isConnected, client, model }: UseBenchmarkOptions) {
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
      const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
      const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];

      const result: BenchmarkResult = {
        id: crypto.randomUUID(),
        model: model || "unknown",
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
  }, [isConnected, client, model, runs, width, height]);

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

  return {
    running,
    progress,
    progressLabel,
    runs,
    setRuns,
    width,
    setWidth,
    height,
    setHeight,
    results,
    selectedResult,
    setSelectedResult,
    active,
    runBenchmark,
    cancelBenchmark,
    clearResults,
    exportResults,
    copyResults,
  };
}

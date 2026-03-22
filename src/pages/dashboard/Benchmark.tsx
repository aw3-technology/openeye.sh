import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gauge,
  Terminal,
  Clock,
  Zap,
  BarChart3,
  Copy,
  Download,
  Trash2,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  Timer,
} from "lucide-react";
import { useBenchmark } from "./benchmark/useBenchmark";
import { BenchmarkConfig } from "./benchmark/BenchmarkConfig";
import { StatCard } from "./benchmark/StatCard";
import { RunHistory } from "./benchmark/RunHistory";
import { LatencyDistribution } from "./benchmark/charts/LatencyDistribution";
import { LatencyTimeline } from "./benchmark/charts/LatencyTimeline";
import { LatencyScatter } from "./benchmark/charts/LatencyScatter";
import { RunComparison } from "./benchmark/charts/RunComparison";

export default function Benchmark() {
  const { isConnected, healthData, client } = useOpenEyeConnection();
  const bench = useBenchmark({ isConnected, client, model: healthData?.model });

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
          {bench.results.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={bench.copyResults} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={bench.exportResults} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="ghost" size="sm" onClick={bench.clearResults} className="gap-1.5 text-muted-foreground">
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
      <BenchmarkConfig
        runs={bench.runs}
        setRuns={bench.setRuns}
        width={bench.width}
        setWidth={bench.setWidth}
        height={bench.height}
        setHeight={bench.setHeight}
        running={bench.running}
        isConnected={isConnected}
        progress={bench.progress}
        progressLabel={bench.progressLabel}
        onRun={bench.runBenchmark}
        onCancel={bench.cancelBenchmark}
      />

      {/* Results Detail */}
      {bench.active && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Mean"
              value={`${bench.active.mean_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="Median"
              value={`${bench.active.median_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="P95"
              value={`${bench.active.p95_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Timer className="h-3.5 w-3.5" />}
              label="P99"
              value={`${bench.active.p99_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<TrendingDown className="h-3.5 w-3.5 text-terminal-green" />}
              label="Min"
              value={`${bench.active.min_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<TrendingUp className="h-3.5 w-3.5 text-destructive" />}
              label="Max"
              value={`${bench.active.max_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<ArrowUpDown className="h-3.5 w-3.5" />}
              label="Std Dev"
              value={`${bench.active.std_ms.toFixed(1)} ms`}
            />
            <StatCard
              icon={<Zap className="h-3.5 w-3.5 text-terminal-green" />}
              label="FPS"
              value={`${bench.active.fps}`}
              highlight
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="distribution">
            <TabsList>
              <TabsTrigger value="distribution">Latency Distribution</TabsTrigger>
              <TabsTrigger value="timeline">Run Timeline</TabsTrigger>
              <TabsTrigger value="scatter">Scatter</TabsTrigger>
              {bench.results.length > 1 && (
                <TabsTrigger value="compare">Compare Runs</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="distribution" className="mt-4">
              <LatencyDistribution result={bench.active} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <LatencyTimeline result={bench.active} />
            </TabsContent>

            <TabsContent value="scatter" className="mt-4">
              <LatencyScatter result={bench.active} />
            </TabsContent>

            {bench.results.length > 1 && (
              <TabsContent value="compare" className="mt-4">
                <RunComparison results={bench.results} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      {/* Run History */}
      <RunHistory
        results={bench.results}
        activeId={bench.active?.id}
        onSelect={bench.setSelectedResult}
      />

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
            $ openeye bench yolov8 --runs {bench.runs} --width {bench.width} --height{" "}
            {bench.height}
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

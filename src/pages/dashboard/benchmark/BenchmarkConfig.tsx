import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Play, Loader2 } from "lucide-react";

interface BenchmarkConfigProps {
  runs: number;
  setRuns: (v: number) => void;
  width: number;
  setWidth: (v: number) => void;
  height: number;
  setHeight: (v: number) => void;
  running: boolean;
  isConnected: boolean;
  progress: number;
  progressLabel: string;
  onRun: () => void;
  onCancel: () => void;
}

export function BenchmarkConfig({
  runs,
  setRuns,
  width,
  setWidth,
  height,
  setHeight,
  running,
  isConnected,
  progress,
  progressLabel,
  onRun,
  onCancel,
}: BenchmarkConfigProps) {
  return (
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
              onClick={running ? onCancel : onRun}
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
  );
}

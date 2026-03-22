import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Gauge, Terminal } from "lucide-react";
import { benchmarks } from "@/data/modelsData";

export function BenchmarksTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-terminal-green" />
            Performance Benchmarks
          </CardTitle>
          <CardDescription>
            Inference speed measured on NVIDIA T4 (TensorRT FP16). Accuracy on COCO val 50-95 for detection, zero-shot for segmentation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="text-terminal-green">Speed</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Backend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {benchmarks.map((row) => (
                <TableRow key={row.model}>
                  <TableCell className="font-medium">
                    {row.model}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {row.task}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-terminal-green">
                    {row.speed}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.accuracy}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                    {row.size}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.backend}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Speed comparison visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relative Speed</CardTitle>
          <CardDescription>
            Inference latency comparison — shorter bars are faster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {benchmarks.map((row) => {
            const ms = parseFloat(row.speed.replace(/[^0-9.]/g, "")) || 0;
            const unit = row.speed.includes("s") && !row.speed.includes("ms") ? "s" : "ms";
            const msNorm = unit === "s" ? ms * 1000 : ms;
            const maxMs = 2000;
            const pct = Math.min((msNorm / maxMs) * 100, 100);
            return (
              <div key={row.model} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{row.model}</span>
                  <span className="font-mono text-terminal-green">
                    {row.speed}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor:
                        msNorm < 10
                          ? "hsl(var(--terminal-green))"
                          : msNorm < 100
                            ? "hsl(var(--terminal-amber))"
                            : "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="p-3 bg-muted/50 rounded-md border">
        <div className="flex items-start gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">
              Run your own benchmarks with the CLI:
            </p>
            <code className="block font-mono text-terminal-green">
              $ openeye bench yolov8 --runs 50 --width 640 --height 480
            </code>
            <p>
              Or use the dashboard{" "}
              <span className="font-medium text-foreground">Benchmark</span>{" "}
              page for end-to-end latency measurements including network
              round-trip.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

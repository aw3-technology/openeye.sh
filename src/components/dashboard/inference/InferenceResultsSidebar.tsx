import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Gauge, ImagePlus } from "lucide-react";
import type { PredictionResult } from "@/types/openeye";
import { latencyColor } from "@/lib/format-utils";

export function InferenceResultsSidebar({ result }: { result: PredictionResult }) {
  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-foreground/10 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Model</span>
            <span className="font-mono">{result.model}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Task</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {result.task}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Objects</span>
            <span className="font-mono tabular-nums font-semibold">
              {result.objects.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Inference</span>
            <span className={`font-mono tabular-nums font-semibold ${latencyColor(result.inference_ms)}`}>
              {result.inference_ms.toFixed(1)}ms
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Resolution</span>
            <span className="font-mono tabular-nums">
              {result.image.width}&times;{result.image.height}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Timestamp</span>
            <span className="font-mono tabular-nums text-[10px]">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Object Distribution */}
      {result.objects.length > 0 && <ObjectDistribution objects={result.objects} />}

      {/* Bounding Box Details */}
      {result.objects.length > 0 && (
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              Bounding Boxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {result.objects.map((obj, i) => (
                <div
                  key={`bbox-${obj.label}-${i}`}
                  className="flex items-center justify-between font-mono text-[10px] py-1 px-2 rounded bg-foreground/5"
                >
                  <span className="text-muted-foreground truncate max-w-[80px]">
                    {obj.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    [{obj.bbox.x.toFixed(2)}, {obj.bbox.y.toFixed(2)}, {obj.bbox.w.toFixed(2)},{" "}
                    {obj.bbox.h.toFixed(2)}]
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Object Distribution ────────────────────────────────────────── */

function ObjectDistribution({ objects }: { objects: PredictionResult["objects"] }) {
  const labelCounts: Record<string, { count: number; avgConf: number }> = {};
  objects.forEach((o) => {
    if (!labelCounts[o.label]) labelCounts[o.label] = { count: 0, avgConf: 0 };
    labelCounts[o.label].count += 1;
    labelCounts[o.label].avgConf += o.confidence;
  });
  Object.values(labelCounts).forEach((v) => {
    v.avgConf /= v.count;
  });
  const sorted = Object.entries(labelCounts).sort((a, b) => b[1].count - a[1].count);

  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-3.5 w-3.5 text-green-400" />
          Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map(([label, { count, avgConf }]) => {
            const pct = Math.round((count / objects.length) * 100);
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="truncate max-w-[120px]">{label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {count} &middot; {(avgConf * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

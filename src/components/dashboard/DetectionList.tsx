import { useEffect, useRef } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Detection Timeline Sparkline                                       */
/* ------------------------------------------------------------------ */

const TIMELINE_LENGTH = 40;

function DetectionTimeline({ count }: { count: number }) {
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    historyRef.current = [...historyRef.current, count].slice(-TIMELINE_LENGTH);
  }, [count]);

  const points = historyRef.current;
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const h = 28;
  const w = 120;
  const step = w / (TIMELINE_LENGTH - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-60">
      <path d={d} fill="none" stroke="hsl(var(--terminal-green))" strokeWidth="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Detection List                                                     */
/* ------------------------------------------------------------------ */

export function DetectionList() {
  const { latestResult, isStreaming } = useOpenEyeStream();

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-terminal-green" />
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Detections
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {latestResult && latestResult.objects.length > 0 && (
              <>
                <DetectionTimeline count={latestResult.objects.length} />
                <Badge variant="outline" className="text-[9px] font-mono">
                  {latestResult.objects.length}
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!latestResult || latestResult.objects.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono py-3 text-center">
            {isStreaming ? "No objects detected yet..." : "Start camera to see detections."}
          </p>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
            {latestResult.objects.map((obj, i) => {
              const isPerson = obj.label.toLowerCase() === "person";
              const isHazard =
                obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
              const confidence = obj.confidence * 100;

              return (
                <div
                  key={`${obj.label}-${i}`}
                  className={`flex items-center justify-between font-mono text-[11px] py-1.5 px-2 rounded-md ${
                    isHazard
                      ? "bg-terminal-amber/5 border border-terminal-amber/10"
                      : isPerson
                        ? "bg-purple-500/5 border border-purple-500/10"
                        : "bg-foreground/5 border border-foreground/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isHazard
                          ? "bg-terminal-amber"
                          : isPerson
                            ? "bg-purple-400"
                            : "bg-terminal-green"
                      }`}
                    />
                    <span
                      className={
                        isHazard
                          ? "text-terminal-amber"
                          : isPerson
                            ? "text-purple-400"
                            : ""
                      }
                    >
                      {obj.label}
                    </span>
                    {isHazard && (
                      <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                        hazard
                      </span>
                    )}
                    {isPerson && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                        {obj.bbox.h > 0.6
                          ? "CLOSE"
                          : obj.bbox.h > 0.3
                            ? "MED"
                            : "FAR"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          confidence > 80
                            ? "bg-terminal-green"
                            : confidence > 50
                              ? "bg-terminal-amber"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground w-10 text-right text-[10px]">
                      {confidence.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

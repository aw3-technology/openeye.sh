import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiffResult } from "@/types/openeye";

interface DiffViewProps {
  beforeUrl: string;
  afterUrl: string;
  result: DiffResult;
}

export function DiffView({ beforeUrl, afterUrl, result }: DiffViewProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("side-by-side");

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("side-by-side")}
          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
            viewMode === "side-by-side"
              ? "bg-terminal-green/15 text-terminal-green border border-terminal-green/30"
              : "text-muted-foreground border border-foreground/10 hover:border-foreground/20"
          }`}
        >
          Side by Side
        </button>
        <button
          onClick={() => setViewMode("slider")}
          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
            viewMode === "slider"
              ? "bg-terminal-green/15 text-terminal-green border border-terminal-green/30"
              : "text-muted-foreground border border-foreground/10 hover:border-foreground/20"
          }`}
        >
          Slider
        </button>

        <div className="ml-auto flex items-center gap-2">
          {result.regression_detected ? (
            <Badge variant="destructive" className="text-[10px]">REGRESSION</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-terminal-green border-terminal-green/30">PASS</Badge>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            {result.pixel_diff_pct.toFixed(1)}% changed | SSIM {result.ssim.toFixed(4)}
          </span>
        </div>
      </div>

      {/* View modes */}
      {viewMode === "side-by-side" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wider">Before</p>
            <img src={beforeUrl} alt="Before" className="rounded-lg border border-foreground/10 w-full object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wider">After</p>
            <img src={afterUrl} alt="After" className="rounded-lg border border-foreground/10 w-full object-contain" />
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border border-foreground/10">
          <img src={afterUrl} alt="After" className="w-full object-contain" />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPosition}%` }}
          >
            <img src={beforeUrl} alt="Before" className="w-full object-contain" style={{ minWidth: "100%" }} />
          </div>
          <div
            className="absolute inset-y-0 w-0.5 bg-white/80 cursor-ew-resize"
            style={{ left: `${sliderPosition}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/2 opacity-60"
          />
        </div>
      )}

      {/* Changes list */}
      {result.changes.length > 0 && (
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Changes ({result.changes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {result.changes.map((change, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono border border-foreground/5 rounded p-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 shrink-0 ${
                      change.type === "regression"
                        ? "text-red-500 border-red-500/30"
                        : change.type === "intentional"
                          ? "text-terminal-green border-terminal-green/30"
                          : "text-terminal-amber border-terminal-amber/30"
                    }`}
                  >
                    {change.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 shrink-0 ${
                      change.severity === "critical"
                        ? "text-red-500 border-red-500/30"
                        : change.severity === "warning"
                          ? "text-amber-500 border-amber-500/30"
                          : "text-blue-400 border-blue-400/30"
                    }`}
                  >
                    {change.severity}
                  </Badge>
                  <div>
                    <p>{change.description}</p>
                    {change.suggestion && (
                      <p className="text-terminal-green mt-0.5">Fix: {change.suggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.summary && (
        <p className="text-xs font-mono text-muted-foreground">
          {result.summary} — {result.analysis_ms.toFixed(0)}ms ({result.model})
        </p>
      )}
    </div>
  );
}

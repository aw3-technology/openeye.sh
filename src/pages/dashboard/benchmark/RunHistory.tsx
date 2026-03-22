import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { BenchmarkResult } from "./types";

interface RunHistoryProps {
  results: BenchmarkResult[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}

export function RunHistory({ results, activeId, onSelect }: RunHistoryProps) {
  if (results.length <= 1) return null;

  return (
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
              onClick={() => onSelect(r.id)}
              className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                r.id === activeId
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
  );
}

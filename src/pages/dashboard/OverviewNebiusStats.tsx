import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Brain,
  Gauge,
  Hash,
  Zap,
} from "lucide-react";
import type { NebiusStats } from "@/lib/openeye-client";

interface OverviewNebiusStatsProps {
  nebiusStats: NebiusStats;
}

export function OverviewNebiusStats({ nebiusStats }: OverviewNebiusStatsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-purple-500" aria-hidden="true" />
          Nebius Token Factory
          <span className="ml-auto text-xs font-normal text-muted-foreground font-mono">
            {nebiusStats.model}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-purple-500/10 p-2">
              <Hash className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VLM Calls</p>
              <p className="text-xl font-semibold tabular-nums">
                {nebiusStats.total_calls}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-500/10 p-2">
              <Zap className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens Used</p>
              <p className="text-xl font-semibold tabular-nums">
                {nebiusStats.total_tokens_estimated.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-green-500/10 p-2">
              <Gauge className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Latency</p>
              <p className="text-xl font-semibold tabular-nums">
                {nebiusStats.avg_latency_ms > 0
                  ? `${(nebiusStats.avg_latency_ms / 1000).toFixed(1)}s`
                  : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-md p-2 ${nebiusStats.errors > 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
              <Activity className={`h-4 w-4 ${nebiusStats.errors > 0 ? "text-red-500" : "text-green-500"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-xl font-semibold tabular-nums">
                {nebiusStats.total_calls > 0
                  ? `${(((nebiusStats.total_calls - nebiusStats.errors) / nebiusStats.total_calls) * 100).toFixed(0)}%`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

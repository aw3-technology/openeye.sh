import { scoreColor } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import type { DebugAnalysis } from "@/types/openeye";

interface LiveDebugViewProps {
  latestAnalysis: DebugAnalysis | null;
  history: DebugAnalysis[];
  isActive: boolean;
  isPending: boolean;
}

export function LiveDebugView({ latestAnalysis, history, isActive, isPending }: LiveDebugViewProps) {
  const recentScores = history.slice(-20).map((a) => a.overall_score);
  const avgScore = recentScores.length > 0
    ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
    : 0;

  const totalIssues = history.reduce((sum, a) => sum + a.issues.length, 0);
  const criticals = history.reduce(
    (sum, a) => sum + a.issues.filter((i) => i.severity === "critical").length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={`text-[10px] font-mono ${
            isActive
              ? isPending
                ? "border-terminal-amber/50 text-terminal-amber animate-pulse"
                : "border-terminal-green/50 text-terminal-green"
              : "border-foreground/20 text-muted-foreground"
          }`}
        >
          {isActive ? (isPending ? "ANALYZING..." : "WATCHING") : "STOPPED"}
        </Badge>
        <span className="text-xs font-mono text-muted-foreground">
          {history.length} frames analyzed
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-terminal-green" />
              <CardTitle className="text-xs text-muted-foreground">Avg Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold tabular-nums ${scoreColor(avgScore)}`}>
              {avgScore || "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-terminal-green" />
              <CardTitle className="text-xs text-muted-foreground">Current Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold tabular-nums ${scoreColor(latestAnalysis?.overall_score ?? 0)}`}>
              {latestAnalysis?.overall_score ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <CardTitle className="text-xs text-muted-foreground">Total Issues</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totalIssues}</p>
          </CardContent>
        </Card>

        <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <CardTitle className="text-xs text-muted-foreground">Criticals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-red-400">{criticals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Score timeline */}
      {recentScores.length > 1 && (
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Score Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-16">
              {recentScores.map((score, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-all ${
                    score >= 80 ? "bg-terminal-green/60" : score >= 60 ? "bg-amber-500/60" : "bg-red-500/60"
                  }`}
                  style={{ height: `${score}%` }}
                  title={`Frame ${history.length - recentScores.length + i + 1}: ${score}/100`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>Oldest</span>
              <span>Latest</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest issues */}
      {latestAnalysis && latestAnalysis.issues.length > 0 && (
        <Card className="border-foreground/10 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Latest Issues ({latestAnalysis.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {latestAnalysis.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 shrink-0 ${
                      issue.severity === "critical"
                        ? "text-red-500 border-red-500/30"
                        : issue.severity === "warning"
                          ? "text-amber-500 border-amber-500/30"
                          : "text-blue-400 border-blue-400/30"
                    }`}
                  >
                    {issue.severity}
                  </Badge>
                  <span>{issue.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {latestAnalysis?.summary && (
        <p className="text-xs font-mono text-muted-foreground">
          {latestAnalysis.summary} — {latestAnalysis.analysis_ms.toFixed(0)}ms ({latestAnalysis.model})
        </p>
      )}
    </div>
  );
}

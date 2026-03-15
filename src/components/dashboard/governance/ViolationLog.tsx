import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGovernanceViolations } from "@/hooks/useGovernanceQueries";
import { ShieldX } from "lucide-react";
import type { AuditEntry } from "@/types/governance";

const decisionColor: Record<string, string> = {
  deny: "text-red-400",
  warn: "text-yellow-400",
  modify: "text-purple-400",
  allow: "text-teal-400",
  audit_only: "text-gray-400",
};

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}

export function ViolationLog() {
  const { data: violations, isLoading } = useGovernanceViolations(30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldX className="h-4 w-4 text-red-400" />
          Violations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (!violations || violations.length === 0) && (
          <p className="text-sm text-muted-foreground">No violations recorded.</p>
        )}
        <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
          {(violations || []).map((entry: AuditEntry, i: number) => (
            <div key={i} className="flex gap-2 rounded px-1.5 py-0.5 hover:bg-muted/50">
              <span className="shrink-0 text-muted-foreground">{formatTime(entry.timestamp)}</span>
              <span className={`shrink-0 font-semibold uppercase ${decisionColor[entry.decision] || ""}`}>
                {entry.decision}
              </span>
              <span className="text-cyan-400">[{entry.policy_name}]</span>
              <span className="truncate text-foreground">{entry.reason}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

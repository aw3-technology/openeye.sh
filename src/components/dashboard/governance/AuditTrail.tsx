import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGovernanceAudit } from "@/hooks/useGovernanceQueries";
import { ScrollText } from "lucide-react";
import type { AuditEntry } from "@/types/governance";

const decisionBadge: Record<string, string> = {
  deny: "bg-red-500/15 text-red-400 border-red-500/30",
  warn: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  allow: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  modify: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  audit_only: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function AuditTrail() {
  const { data: entries, isLoading } = useGovernanceAudit(50);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!entries || entries.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            )}
            {(entries || []).map((entry: AuditEntry, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(entry.timestamp)}
                </TableCell>
                <TableCell className="text-xs font-medium">{entry.policy_name}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      decisionBadge[entry.decision] || decisionBadge.allow
                    }`}
                  >
                    {entry.decision}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{entry.severity}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">{entry.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

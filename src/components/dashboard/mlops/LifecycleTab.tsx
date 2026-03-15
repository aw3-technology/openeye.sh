import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stageBadgeVariant } from "@/hooks/useMLOpsQueries";
import type { UseQueryResult } from "@tanstack/react-query";
import type { PromotionRecord, ValidationTestRun } from "@/types/mlops";

interface LifecycleTabProps {
  promotions: UseQueryResult<PromotionRecord[]>;
  validationRuns: UseQueryResult<ValidationTestRun[]>;
}

export function LifecycleTab({ promotions, validationRuns }: LifecycleTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stage Promotions</CardTitle>
        </CardHeader>
        <CardContent>
          {promotions.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.data.map((p) => (
                  <TableRow key={`${p.model_key}-${p.version}-${p.to_stage}-${p.created_at}`}>
                    <TableCell className="font-mono">{p.model_key}</TableCell>
                    <TableCell className="font-mono">v{p.version}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Badge variant="outline">{p.from_stage}</Badge>
                        <span className="text-muted-foreground">&rarr;</span>
                        <Badge variant={stageBadgeVariant[p.to_stage] ?? "outline"}>
                          {p.to_stage}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "approved"
                            ? "default"
                            : p.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.requester}</TableCell>
                    <TableCell>{p.approver || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.reason || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No promotion records.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          {validationRuns.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validationRuns.data.map((r) => (
                  <TableRow key={`${r.test_id}-${r.model_key}-${r.model_version}-${r.run_at}`}>
                    <TableCell className="font-mono text-xs">{r.test_id}</TableCell>
                    <TableCell className="font-mono">{r.model_key}</TableCell>
                    <TableCell className="font-mono">v{r.model_version}</TableCell>
                    <TableCell>
                      <Badge variant={r.passed ? "default" : "destructive"}>
                        {r.passed ? "PASSED" : "FAILED"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {r.condition_results.map((cr, j) => (
                          <div key={j} className="flex items-center gap-1 text-xs">
                            <span className={cr.passed ? "text-green-500" : "text-red-500"}>
                              {cr.passed ? "+" : "x"}
                            </span>
                            <span className="font-mono">{cr.condition}</span>
                            <span className="text-muted-foreground">
                              = {cr.actual_value.toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{r.run_duration_seconds.toFixed(1)}s</TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.run_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No validation runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

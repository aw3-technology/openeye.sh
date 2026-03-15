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
import type { UseQueryResult } from "@tanstack/react-query";
import type { ABTestResult } from "@/types/mlops";

interface ABTestingTabProps {
  abTests: UseQueryResult<ABTestResult[]>;
}

export function ABTestingTab({ abTests }: ABTestingTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>A/B Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {abTests.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>A (Control)</TableHead>
                  <TableHead>B (Challenger)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>A Accuracy</TableHead>
                  <TableHead>B Accuracy</TableHead>
                  <TableHead>A Latency</TableHead>
                  <TableHead>B Latency</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Winner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abTests.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="font-mono">{t.config.model_key}</TableCell>
                    <TableCell className="font-mono">v{t.config.version_a}</TableCell>
                    <TableCell className="font-mono">v{t.config.version_b}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "running"
                            ? "default"
                            : t.status === "completed"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.metrics_a.samples
                        ? `${(t.metrics_a.mean_accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.metrics_b.samples
                        ? `${(t.metrics_b.mean_accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.metrics_a.samples
                        ? `${t.metrics_a.mean_latency_ms.toFixed(1)}ms`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.metrics_b.samples
                        ? `${t.metrics_b.mean_latency_ms.toFixed(1)}ms`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.metrics_a.samples + t.metrics_b.samples}
                    </TableCell>
                    <TableCell>
                      {t.winner ? (
                        <Badge variant="default">v{t.winner}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No A/B tests. Use <code>openeye mlops ab-test</code> to create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import type { ShadowDeployment } from "@/types/mlops";

interface ShadowTabProps {
  shadowDeps: UseQueryResult<ShadowDeployment[]>;
}

export function ShadowTab({ shadowDeps }: ShadowTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Shadow Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          {shadowDeps.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead>Shadow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Prod Latency</TableHead>
                  <TableHead>Shadow Latency</TableHead>
                  <TableHead>Divergent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shadowDeps.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.id}</TableCell>
                    <TableCell className="font-mono">{d.config.model_key}</TableCell>
                    <TableCell className="font-mono">v{d.config.production_version}</TableCell>
                    <TableCell className="font-mono">v{d.config.shadow_version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "active"
                            ? "default"
                            : d.status === "completed"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.comparison.total_samples}</TableCell>
                    <TableCell>
                      {d.comparison.total_samples
                        ? `${(d.comparison.agreement_rate * 100).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {d.comparison.total_samples
                        ? `${d.comparison.production_mean_latency_ms.toFixed(1)}ms`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {d.comparison.total_samples
                        ? `${d.comparison.shadow_mean_latency_ms.toFixed(1)}ms`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {d.comparison.divergent_samples.length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No shadow deployments. Use <code>openeye mlops shadow</code> to create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

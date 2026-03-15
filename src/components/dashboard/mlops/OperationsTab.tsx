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
import type { RetrainingRun, BatchInferenceJob } from "@/types/mlops";

interface OperationsTabProps {
  retrainingRuns: UseQueryResult<RetrainingRun[]>;
  batchJobs: UseQueryResult<BatchInferenceJob[]>;
}

export function OperationsTab({ retrainingRuns, batchJobs }: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Retraining Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {retrainingRuns.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>New Version</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retrainingRuns.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.pipeline_name}</TableCell>
                    <TableCell className="font-mono">{r.model_key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.trigger}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "completed"
                            ? "default"
                            : r.status === "failed"
                            ? "destructive"
                            : r.status === "running"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.triggered_by}</TableCell>
                    <TableCell className="font-mono">
                      {r.new_version ? `v${r.new_version}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.started_at
                        ? new Date(r.started_at).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No retraining runs.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batch Inference Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {batchJobs.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchJobs.data.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.id}</TableCell>
                    <TableCell className="font-mono">{j.config.model_key}</TableCell>
                    <TableCell className="font-mono">v{j.config.model_version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          j.status === "completed"
                            ? "default"
                            : j.status === "failed"
                            ? "destructive"
                            : j.status === "running"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {j.progress.total_images > 0
                        ? `${j.progress.processed}/${j.progress.total_images} (${j.progress.failed} failed)`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {j.progress.images_per_second > 0
                        ? `${j.progress.images_per_second.toFixed(1)} img/s`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {j.result_path || j.config.output_path}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(j.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No batch jobs.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import type { ModelLineage } from "@/types/mlops";

interface LineageTabProps {
  lineage: UseQueryResult<ModelLineage[]>;
}

export function LineageTab({ lineage }: LineageTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Model Provenance & Lineage</CardTitle>
        </CardHeader>
        <CardContent>
          {lineage.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Dataset Ver.</TableHead>
                  <TableHead>Framework</TableHead>
                  <TableHead>Repo</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineage.data.map((l) => (
                  <TableRow key={`${l.model_key}-${l.version}`}>
                    <TableCell className="font-mono">{l.model_key}</TableCell>
                    <TableCell className="font-mono">v{l.version}</TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {l.dataset}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.dataset_version}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.training_framework}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[140px] truncate">
                      {l.code_repo}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.code_branch}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.code_commit ? l.code_commit.slice(0, 8) : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {l.parent_model ? (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {l.parent_model}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">\u2014</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.training_duration_seconds != null
                        ? `${(l.training_duration_seconds / 60).toFixed(1)}m`
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(l.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No lineage records. Lineage is recorded when models are registered with provenance metadata.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Environment details for each lineage record */}
      {lineage.data?.filter((l) => Object.keys(l.environment).length > 0).map((l) => (
        <Card key={`${l.model_key}-${l.version}-env`}>
          <CardHeader>
            <CardTitle className="text-base">
              {l.model_key} v{l.version} — Training Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(l.environment).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="font-mono text-xs text-muted-foreground">{key}</span>
                  <span className="font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

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
import type { ModelRegistryEntry, ExportResult } from "@/types/mlops";

interface RegistryTabProps {
  models: UseQueryResult<ModelRegistryEntry[]>;
  exports: UseQueryResult<ExportResult[]>;
}

export function RegistryTab({ models, exports }: RegistryTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Enterprise Model Registry</CardTitle>
        </CardHeader>
        <CardContent>
          {models.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Versions</TableHead>
                  <TableHead>Latest</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.data.map((m) => {
                  const latest = m.versions[m.versions.length - 1];
                  const prod = [...m.versions].reverse().find((v) => v.stage === "production");
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-mono text-sm">{m.key}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.task}</TableCell>
                      <TableCell>{m.versions.length}</TableCell>
                      <TableCell>
                        {latest && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">v{latest.version}</span>
                            <Badge variant={stageBadgeVariant[latest.stage] ?? "outline"}>
                              {latest.stage}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {prod ? (
                          <span className="font-mono text-sm">v{prod.version}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {m.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No models registered yet. Use <code>openeye mlops upload</code> to register a model.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Version details for each model */}
      {models.data?.map((m) =>
        m.versions.length > 0 ? (
          <Card key={m.key}>
            <CardHeader>
              <CardTitle className="text-base">
                {m.name} — Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-mono">v{v.version}</TableCell>
                      <TableCell>
                        <Badge variant={stageBadgeVariant[v.stage] ?? "outline"}>
                          {v.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>{v.format}</TableCell>
                      <TableCell>{v.file_size_mb.toFixed(1)} MB</TableCell>
                      <TableCell>{v.author || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {v.training_dataset || "—"}
                      </TableCell>
                      <TableCell>
                        {v.training_metrics.accuracy != null
                          ? `${(v.training_metrics.accuracy * 100).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.code_commit ? v.code_commit.slice(0, 8) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(v.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null
      )}

      {/* Exports */}
      {exports.data && exports.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model Exports</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Quantized</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.data.map((e) => (
                  <TableRow key={`${e.model_key}-${e.model_version}-${e.target_format}-${e.created_at}`}>
                    <TableCell className="font-mono">{e.model_key}</TableCell>
                    <TableCell className="font-mono">v{e.model_version}</TableCell>
                    <TableCell>{e.source_format}</TableCell>
                    <TableCell>
                      <Badge>{e.target_format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{e.output_size_mb.toFixed(1)} MB</TableCell>
                    <TableCell>{e.quantized ? "Yes" : "No"}</TableCell>
                    <TableCell>{e.export_duration_seconds.toFixed(1)}s</TableCell>
                    <TableCell className="text-xs">
                      {new Date(e.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

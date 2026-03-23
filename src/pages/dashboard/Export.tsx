import { useState } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import { FileJson, FileSpreadsheet, PackageOpen } from "lucide-react";
import { parseObjects } from "./exportUtils";
import { exportBulkJSON, exportBulkCSV } from "./exportFormats";
import { ExportResultSelector } from "./ExportResultSelector";
import { ExportActions } from "./ExportActions";

export default function Export() {
  const { data, isLoading } = useInferenceHistory(0, 50);
  const rows = data?.data || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) || null;

  const selectedObjects = selected ? parseObjects(selected.objects_json) : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Export</h1>
        <LoadingState message="Loading inference history..." />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Export</h1>
        <EmptyState message="No results to export. Run an inference first." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Export</h1>
        <Badge variant="secondary" className="font-mono text-xs">
          {rows.length} results
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            Bulk Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Export all {rows.length} results at once.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportBulkJSON(rows)}>
              <FileJson className="h-4 w-4" />
              All as JSON
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportBulkCSV(rows)}>
              <FileSpreadsheet className="h-4 w-4" />
              All as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <ExportResultSelector rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
        <ExportActions selected={selected} selectedObjects={selectedObjects} />
      </div>
    </div>
  );
}

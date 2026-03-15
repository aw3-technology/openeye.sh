import { useState } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Image,
  PackageOpen,
  CheckCircle2,
} from "lucide-react";
import type { DetectedObject, InferenceHistoryRow } from "@/types/openeye";
import { toast } from "sonner";
import { format } from "date-fns";

/* ─── helpers ─── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseObjects(json: string): DetectedObject[] {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.warn("[Export] Failed to parse objects_json:", err);
    return [];
  }
}

function rowToPayload(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  return {
    model: row.model,
    task: row.task,
    timestamp: row.timestamp,
    image: { width: row.image_width, height: row.image_height, source: row.image_source },
    objects,
    inference_ms: row.inference_ms,
  };
}

/* ─── single-row exports ─── */

function exportJSON(row: InferenceHistoryRow) {
  const data = rowToPayload(row);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `openeye-${row.id.slice(0, 8)}.json`);
  toast.success("JSON exported");
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCSV(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  const header = "label,confidence,x,y,w,h\n";
  const rows = objects
    .map((o) => `${csvEscape(o.label)},${o.confidence},${o.bbox.x},${o.bbox.y},${o.bbox.w},${o.bbox.h}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  downloadBlob(blob, `openeye-${row.id.slice(0, 8)}.csv`);
  toast.success("CSV exported");
}

function exportCOCO(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  const w = row.image_width || 640;
  const h = row.image_height || 480;

  const categories = [...new Set(objects.map((o) => o.label))].map((label, i) => ({
    id: i + 1,
    name: label,
    supercategory: "none",
  }));
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const coco = {
    images: [{ id: 1, file_name: row.image_source || "image.jpg", width: w, height: h }],
    annotations: objects.map((obj, i) => ({
      id: i + 1,
      image_id: 1,
      category_id: catMap[obj.label],
      bbox: [obj.bbox.x * w, obj.bbox.y * h, obj.bbox.w * w, obj.bbox.h * h],
      area: obj.bbox.w * w * obj.bbox.h * h,
      score: obj.confidence,
      iscrowd: 0,
    })),
    categories,
  };
  const blob = new Blob([JSON.stringify(coco, null, 2)], { type: "application/json" });
  downloadBlob(blob, `openeye-coco-${row.id.slice(0, 8)}.json`);
  toast.success("COCO JSON exported");
}

function exportAnnotatedImage(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  const w = row.image_width || 640;
  const h = row.image_height || 480;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  objects.forEach((obj) => {
    const bx = obj.bbox.x * w;
    const by = obj.bbox.y * h;
    const bw = obj.bbox.w * w;
    const bh = obj.bbox.h * h;

    ctx.strokeStyle = obj.confidence < 0.5 ? "#f59e0b" : "#26c48e";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = obj.confidence < 0.5 ? "#f59e0b" : "#26c48e";
    ctx.font = "12px monospace";
    ctx.fillText(`${obj.label} [${(obj.confidence * 100).toFixed(1)}%]`, bx, by - 4);
  });

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `openeye-annotated-${row.id.slice(0, 8)}.png`);
      toast.success("Annotated image exported");
    } else {
      toast.error("Failed to export annotated image");
    }
  }, "image/png");
}

/* ─── bulk exports ─── */

function exportBulkJSON(rows: InferenceHistoryRow[]) {
  const data = rows.map(rowToPayload);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `openeye-bulk-${rows.length}.json`);
  toast.success(`Exported ${rows.length} results as JSON`);
}

function exportBulkCSV(rows: InferenceHistoryRow[]) {
  const header = "id,model,task,timestamp,inference_ms,object_count,label,confidence,x,y,w,h\n";
  const lines = rows.flatMap((row) => {
    const objects = parseObjects(row.objects_json);
    if (objects.length === 0) {
      return [`${csvEscape(row.id)},${csvEscape(row.model)},${csvEscape(row.task)},${csvEscape(row.timestamp)},${row.inference_ms},0,,,,,,`];
    }
    return objects.map(
      (o) =>
        `${csvEscape(row.id)},${csvEscape(row.model)},${csvEscape(row.task)},${csvEscape(row.timestamp)},${row.inference_ms},${row.object_count},${csvEscape(o.label)},${o.confidence},${o.bbox.x},${o.bbox.y},${o.bbox.w},${o.bbox.h}`,
    );
  });
  const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
  downloadBlob(blob, `openeye-bulk-${rows.length}.csv`);
  toast.success(`Exported ${rows.length} results as CSV`);
}

/* ─── component ─── */

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

      {/* ── Bulk Export ── */}
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

      {/* ── Single Result Export ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Result selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Select Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedId === row.id
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{row.model}</span>
                    <Badge variant="outline" className="ml-2 text-[10px] shrink-0">
                      {row.object_count} obj
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono tabular-nums">
                    {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")} — {row.inference_ms.toFixed(0)}ms
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Export options + preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Export Options</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a result to export.</p>
            ) : (
              <div className="space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <p>
                    <span className="text-muted-foreground">Model:</span> {selected.model}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Task:</span> {selected.task}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Resolution:</span>{" "}
                    <span className="tabular-nums">{selected.image_width}×{selected.image_height}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Inference:</span>{" "}
                    <span className="tabular-nums">{selected.inference_ms.toFixed(1)}ms</span>
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" className="gap-2" onClick={() => exportJSON(selected)}>
                    <FileJson className="h-4 w-4" />
                    JSON
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportCSV(selected)}>
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportCOCO(selected)}>
                    <Download className="h-4 w-4" />
                    COCO
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportAnnotatedImage(selected)}>
                    <Image className="h-4 w-4" />
                    Annotated PNG
                  </Button>
                </div>

                {/* Detection preview */}
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Detected Objects ({selectedObjects.length})
                  </p>
                  {selectedObjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No detections.</p>
                  ) : (
                    <div className="grid gap-1 max-h-[200px] overflow-auto">
                      {selectedObjects.map((obj, i) => (
                        <div
                          key={`${obj.label}-${i}`}
                          className="flex items-center justify-between px-2 py-1 rounded text-xs font-mono bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2
                              className={`h-3 w-3 ${
                                obj.confidence >= 0.5 ? "text-green-500" : "text-amber-500"
                              }`}
                            />
                            <span>{obj.label}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">
                            {(obj.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

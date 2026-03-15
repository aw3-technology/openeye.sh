import { useState } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileSpreadsheet, Image } from "lucide-react";
import type { DetectedObject } from "@/types/openeye";
import type { InferenceHistoryRow } from "@/types/openeye";
import { toast } from "sonner";

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

function exportJSON(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  const data = {
    model: row.model,
    task: row.task,
    timestamp: row.timestamp,
    image: { width: row.image_width, height: row.image_height, source: row.image_source },
    objects,
    inference_ms: row.inference_ms,
  };
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

function exportAnnotatedImage(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);

  const w = row.image_width || 640;
  const h = row.image_height || 480;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Dark background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  // Draw bounding boxes
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

export default function Export() {
  const { data } = useInferenceHistory(0, 50);
  const rows = data?.data || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Export</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Select Result</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No results to export.</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono transition-colors ${
                      selectedId === row.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {row.model} — {row.object_count} obj — {row.inference_ms.toFixed(0)}ms
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Export Options</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a result to export.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {selected.model} — {selected.object_count} objects — {selected.inference_ms.toFixed(1)}ms
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => exportJSON(selected)}
                  >
                    <FileJson className="h-4 w-4" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => exportCSV(selected)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => exportAnnotatedImage(selected)}
                  >
                    <Image className="h-4 w-4" />
                    Annotated PNG
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

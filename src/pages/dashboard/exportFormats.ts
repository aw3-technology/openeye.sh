import type { InferenceHistoryRow } from "@/types/openeye";
import { toast } from "sonner";
import { downloadBlob, parseObjects, rowToPayload, csvEscape } from "./exportUtils";

export function exportJSON(row: InferenceHistoryRow) {
  const data = rowToPayload(row);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `openeye-${row.id.slice(0, 8)}.json`);
  toast.success("JSON exported");
}

export function exportCSV(row: InferenceHistoryRow) {
  const objects = parseObjects(row.objects_json);
  const header = "label,confidence,x,y,w,h\n";
  const rows = objects
    .map((o) => `${csvEscape(o.label)},${o.confidence},${o.bbox.x},${o.bbox.y},${o.bbox.w},${o.bbox.h}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  downloadBlob(blob, `openeye-${row.id.slice(0, 8)}.csv`);
  toast.success("CSV exported");
}

export function exportCOCO(row: InferenceHistoryRow) {
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

export function exportAnnotatedImage(row: InferenceHistoryRow) {
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

export function exportBulkJSON(rows: InferenceHistoryRow[]) {
  const data = rows.map(rowToPayload);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `openeye-bulk-${rows.length}.json`);
  toast.success(`Exported ${rows.length} results as JSON`);
}

export function exportBulkCSV(rows: InferenceHistoryRow[]) {
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

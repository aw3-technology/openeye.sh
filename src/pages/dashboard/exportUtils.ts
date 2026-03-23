import type { DetectedObject, InferenceHistoryRow } from "@/types/openeye";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseObjects(json: string): DetectedObject[] {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.warn("[Export] Failed to parse objects_json:", err);
    return [];
  }
}

export function rowToPayload(row: InferenceHistoryRow) {
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

export function csvEscape(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

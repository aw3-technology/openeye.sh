import { useMemo, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import type { InferenceHistoryRow, DetectedObject } from "@/types/openeye";
import { parseObjects, taskBadgeVariant } from "./utils";

interface HistoryDetailDialogProps {
  row: InferenceHistoryRow | null;
  onClose: () => void;
}

export function HistoryDetailDialog({ row, onClose }: HistoryDetailDialogProps) {
  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Inference Detail
            {row && (
              <Badge variant={taskBadgeVariant(row.task)}>{row.task}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {row && <HistoryDetail row={row} />}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDetail({ row }: { row: InferenceHistoryRow }) {
  const objects = parseObjects(row.objects_json);

  const labelCounts = useMemo(() => {
    const counts: Record<string, { count: number; avgConf: number }> = {};
    objects.forEach((o) => {
      if (!counts[o.label]) counts[o.label] = { count: 0, avgConf: 0 };
      counts[o.label].count += 1;
      counts[o.label].avgConf += o.confidence;
    });
    Object.values(counts).forEach((v) => {
      v.avgConf /= v.count;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  }, [objects]);

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetaItem label="Model" value={row.model} mono />
        <MetaItem label="Task" value={row.task} />
        <MetaItem
          label="Resolution"
          value={`${row.image_width}x${row.image_height}`}
          mono
        />
        <MetaItem
          label="Latency"
          value={`${row.inference_ms.toFixed(1)}ms`}
          mono
        />
        <MetaItem label="Source" value={row.image_source || "\u2014"} />
        <MetaItem
          label="Timestamp"
          value={format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
          mono
        />
        <MetaItem label="Objects" value={String(row.object_count)} mono />
        <MetaItem label="ID" value={row.id.slice(0, 8)} mono />
      </div>

      <BboxPreview
        objects={objects}
        width={row.image_width || 640}
        height={row.image_height || 480}
        thumbnailUrl={row.thumbnail_url}
      />

      {labelCounts.length > 0 && (
        <DetectionDistribution
          labelCounts={labelCounts}
          totalObjects={objects.length}
        />
      )}

      {objects.length > 0 && <DetectionList objects={objects} />}

      {objects.length === 0 && (
        <p className="text-xs text-muted-foreground">No objects detected.</p>
      )}
    </div>
  );
}

function DetectionDistribution({
  labelCounts,
  totalObjects,
}: {
  labelCounts: [string, { count: number; avgConf: number }][];
  totalObjects: number;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        Detection Distribution
      </p>
      <div className="space-y-1.5">
        {labelCounts.map(([label, { count, avgConf }]) => {
          const pct =
            totalObjects > 0 ? Math.round((count / totalObjects) * 100) : 0;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs font-mono w-24 truncate">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                {count}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
                {(avgConf * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetectionList({ objects }: { objects: DetectedObject[] }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        All Detections ({objects.length})
      </p>
      <div className="grid gap-1 max-h-[200px] overflow-y-auto pr-1">
        {objects.map((obj, i) => (
          <div
            key={`${obj.label}-${i}`}
            className="flex items-center justify-between font-mono text-xs py-1 px-2 rounded hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    obj.confidence >= 0.7
                      ? "hsl(var(--terminal-green))"
                      : obj.confidence >= 0.4
                        ? "#f59e0b"
                        : "#ef4444",
                }}
              />
              <span>{obj.label}</span>
              {obj.track_id && (
                <span className="text-muted-foreground">#{obj.track_id}</span>
              )}
            </div>
            <span className="tabular-nums text-muted-foreground">
              {(obj.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BboxPreview({
  objects,
  width,
  height,
  thumbnailUrl,
}: {
  objects: DetectedObject[];
  width: number;
  height: number;
  thumbnailUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aspectRatio = width / height;
  const canvasW = 560;
  const canvasH = Math.round(canvasW / aspectRatio);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const scaleX = canvasW / width;
    const scaleY = canvasH / height;

    const draw = (bgImage?: HTMLImageElement) => {
      ctx.clearRect(0, 0, canvasW, canvasH);

      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
      } else {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvasW; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasH);
          ctx.stroke();
        }
        for (let y = 0; y < canvasH; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasW, y);
          ctx.stroke();
        }
      }

      objects.forEach((obj) => {
        const bx = obj.bbox.x * width * scaleX;
        const by = obj.bbox.y * height * scaleY;
        const bw = obj.bbox.w * width * scaleX;
        const bh = obj.bbox.h * height * scaleY;

        const color =
          obj.confidence >= 0.7
            ? "#26c48e"
            : obj.confidence >= 0.4
              ? "#f59e0b"
              : "#ef4444";

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        const text = `${obj.label} ${(obj.confidence * 100).toFixed(0)}%`;
        ctx.font = "11px monospace";
        const tm = ctx.measureText(text);
        const labelH = 16;
        const labelY = by > labelH ? by - labelH : by;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(bx, labelY, tm.width + 8, labelH);
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#000";
        ctx.fillText(text, bx + 4, labelY + 12);
      });

      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.fillText(
        `${width}x${height} | ${objects.length} objects`,
        8,
        canvasH - 8,
      );
    };

    if (thumbnailUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => draw();
      img.src = thumbnailUrl;
    } else {
      draw();
    }
  }, [objects, width, height, canvasW, canvasH, thumbnailUrl]);

  if (objects.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        Bounding Box Preview
      </p>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="w-full rounded-md border border-border"
        style={{ maxWidth: canvasW, imageRendering: "auto" }}
      />
    </div>
  );
}

function MetaItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

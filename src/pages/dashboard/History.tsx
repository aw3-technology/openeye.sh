import { useState, useMemo, useRef, useEffect } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  Gauge,
  Hash,
  Search,
  X,
} from "lucide-react";
import type { InferenceHistoryRow, DetectedObject } from "@/types/openeye";
import { format, formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 20;

function parseObjects(json: string): DetectedObject[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function latencyColor(ms: number) {
  if (ms < 50) return "text-green-500";
  if (ms < 150) return "text-yellow-500";
  return "text-red-500";
}

function taskBadgeVariant(task: string): "default" | "secondary" | "outline" {
  switch (task) {
    case "detect":
      return "default";
    case "segment":
      return "secondary";
    default:
      return "outline";
  }
}

export default function History() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useInferenceHistory(page, PAGE_SIZE);
  const [selected, setSelected] = useState<InferenceHistoryRow | null>(null);
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Derive unique models and tasks from current page for filter dropdowns
  const uniqueModels = useMemo(
    () => [...new Set(rows.map((r) => r.model))].sort(),
    [rows],
  );
  const uniqueTasks = useMemo(
    () => [...new Set(rows.map((r) => r.task))].sort(),
    [rows],
  );

  // Client-side filter on current page rows
  const filteredRows = useMemo(() => {
    let result = rows;
    if (modelFilter !== "all") {
      result = result.filter((r) => r.model === modelFilter);
    }
    if (taskFilter !== "all") {
      result = result.filter((r) => r.task === taskFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const objects = parseObjects(r.objects_json);
        return (
          r.model.toLowerCase().includes(q) ||
          r.task.toLowerCase().includes(q) ||
          objects.some((o) => o.label.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [rows, modelFilter, taskFilter, searchQuery]);

  // Summary stats computed from current page
  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const totalObjs = rows.reduce((sum, r) => sum + r.object_count, 0);
    const avgLatency =
      rows.reduce((sum, r) => sum + r.inference_ms, 0) / rows.length;
    const labelCounts: Record<string, number> = {};
    rows.forEach((r) => {
      parseObjects(r.objects_json).forEach((o) => {
        labelCounts[o.label] = (labelCounts[o.label] || 0) + 1;
      });
    });
    const topLabel = Object.entries(labelCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    return {
      totalInferences: totalCount,
      totalObjects: totalObjs,
      avgLatency,
      topLabel: topLabel ? `${topLabel[0]} (${topLabel[1]})` : "—",
      uniqueModels: new Set(rows.map((r) => r.model)).size,
    };
  }, [rows, totalCount]);

  const clearFilters = () => {
    setModelFilter("all");
    setTaskFilter("all");
    setSearchQuery("");
  };

  const hasFilters =
    modelFilter !== "all" || taskFilter !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inference History</h1>

      {/* Summary Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-md bg-blue-500/10 p-2">
                <Hash className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Total Inferences
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {stats.totalInferences.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-md bg-green-500/10 p-2">
                <Gauge className="h-4 w-4 text-green-500" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Avg Latency</p>
                <p className="text-xl font-semibold tabular-nums">
                  {stats.avgLatency.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">
                    ms
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-md bg-purple-500/10 p-2">
                <Eye className="h-4 w-4 text-purple-500" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Objects Detected
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {stats.totalObjects.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Top: {stats.topLabel}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-md bg-amber-500/10 p-2">
                <Cpu className="h-4 w-4 text-amber-500" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Models Used</p>
                <p className="text-xl font-semibold tabular-nums">
                  {stats.uniqueModels}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by model, task, or object label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {uniqueModels.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={taskFilter} onValueChange={setTaskFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              {uniqueTasks.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 h-9"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Past Results</CardTitle>
          {hasFilters && filteredRows.length !== rows.length && (
            <span className="text-xs text-muted-foreground">
              Showing {filteredRows.length} of {rows.length} on this page
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState message="No inference history yet. Run an inference from the Inference page to see results here." />
          ) : filteredRows.length === 0 ? (
            <EmptyState message="No results match your filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Objects</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                      <TableHead className="text-right">Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TooltipProvider>
                      {filteredRows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelected(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(row);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View inference from ${format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}`}
                        >
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(
                                    new Date(row.created_at),
                                    { addSuffix: true },
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="font-mono text-xs">
                                  {format(
                                    new Date(row.created_at),
                                    "yyyy-MM-dd HH:mm:ss",
                                  )}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {row.model}
                          </TableCell>
                          <TableCell>
                            <Badge variant={taskBadgeVariant(row.task)}>
                              {row.task}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.image_source || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.object_count}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-mono text-xs ${latencyColor(row.inference_ms)}`}
                          >
                            {row.inference_ms.toFixed(1)}ms
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {row.image_width}x{row.image_height}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TooltipProvider>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Inference Detail
              {selected && (
                <Badge variant={taskBadgeVariant(selected.task)}>
                  {selected.task}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && <HistoryDetail row={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Detail Panel ────────────────────────────────────────────────── */

function HistoryDetail({ row }: { row: InferenceHistoryRow }) {
  const objects = parseObjects(row.objects_json);

  // Aggregate label counts for distribution view
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
      {/* Metadata grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetaItem label="Model" value={row.model} mono />
        <MetaItem label="Task" value={row.task} />
        <MetaItem
          label="Resolution"
          value={`${row.image_width}x${row.image_height}`}
          mono
        />
        <MetaItem label="Latency" value={`${row.inference_ms.toFixed(1)}ms`} mono />
        <MetaItem label="Source" value={row.image_source || "—"} />
        <MetaItem
          label="Timestamp"
          value={format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
          mono
        />
        <MetaItem label="Objects" value={String(row.object_count)} mono />
        <MetaItem label="ID" value={row.id.slice(0, 8)} mono />
      </div>

      {/* Bbox Canvas Preview */}
      <BboxPreview
        objects={objects}
        width={row.image_width || 640}
        height={row.image_height || 480}
        thumbnailUrl={row.thumbnail_url}
      />

      {/* Object distribution */}
      {labelCounts.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Detection Distribution
          </p>
          <div className="space-y-1.5">
            {labelCounts.map(([label, { count, avgConf }]) => {
              const pct =
                objects.length > 0
                  ? Math.round((count / objects.length) * 100)
                  : 0;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-24 truncate">
                    {label}
                  </span>
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
      )}

      {/* Full object list */}
      {objects.length > 0 && (
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
                    <span className="text-muted-foreground">
                      #{obj.track_id}
                    </span>
                  )}
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {(obj.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {objects.length === 0 && (
        <p className="text-xs text-muted-foreground">No objects detected.</p>
      )}
    </div>
  );
}

/* ─── Bbox Canvas ─────────────────────────────────────────────────── */

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
        // Dark grid background
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

      // Draw bounding boxes
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

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Label background
        const text = `${obj.label} ${(obj.confidence * 100).toFixed(0)}%`;
        ctx.font = "11px monospace";
        const tm = ctx.measureText(text);
        const labelH = 16;
        const labelY = by > labelH ? by - labelH : by;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(bx, labelY, tm.width + 8, labelH);
        ctx.globalAlpha = 1;

        // Label text
        ctx.fillStyle = "#000";
        ctx.fillText(text, bx + 4, labelY + 12);
      });

      // Frame info
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

/* ─── Small helpers ───────────────────────────────────────────────── */

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

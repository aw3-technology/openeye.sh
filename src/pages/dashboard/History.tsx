import { useState } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InferenceHistoryRow, DetectedObject } from "@/types/openeye";
import { format } from "date-fns";

const PAGE_SIZE = 20;

export default function History() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useInferenceHistory(page, PAGE_SIZE);
  const [selected, setSelected] = useState<InferenceHistoryRow | null>(null);

  const rows = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inference History</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past Results</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState message="No inference history yet. Run an inference from the Inference page to see results here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Objects</TableHead>
                    <TableHead className="text-right">Inference (ms)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(row)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(row); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View inference from ${format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}`}
                    >
                      <TableCell className="font-mono text-xs tabular-nums">
                        {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm">{row.model}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.object_count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.inference_ms.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} ({totalCount} results)
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
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inference Detail</DialogTitle>
          </DialogHeader>
          {selected && <HistoryDetail row={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryDetail({ row }: { row: InferenceHistoryRow }) {
  let objects: DetectedObject[] = [];
  try {
    const parsed = JSON.parse(row.objects_json);
    if (Array.isArray(parsed)) {
      objects = parsed;
    }
  } catch {
    // ignore malformed JSON
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <p>
          <span className="text-muted-foreground">Model:</span> {row.model}
        </p>
        <p>
          <span className="text-muted-foreground">Task:</span> {row.task}
        </p>
        <p>
          <span className="text-muted-foreground">Resolution:</span>{" "}
          <span className="tabular-nums">{row.image_width}×{row.image_height}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Inference:</span>{" "}
          <span className="tabular-nums">{row.inference_ms.toFixed(1)}ms</span>
        </p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1">Detected Objects ({objects.length})</p>
        {objects.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <div className="space-y-1">
            {objects.map((obj, i) => (
              <div
                key={`${obj.label}-${i}`}
                className="flex justify-between font-mono text-xs"
              >
                <span>{obj.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {(obj.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

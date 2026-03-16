import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { InferenceHistoryRow } from "@/types/openeye";
import { latencyColor, taskBadgeVariant } from "./utils";

interface HistoryTimelineProps {
  rows: InferenceHistoryRow[];
  filteredRows: InferenceHistoryRow[];
  isLoading: boolean;
  hasFilters: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onSelect: (row: InferenceHistoryRow) => void;
}

export function HistoryTimeline({
  rows,
  filteredRows,
  isLoading,
  hasFilters,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onSelect,
}: HistoryTimelineProps) {
  return (
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
                      <TimelineRow
                        key={row.id}
                        row={row}
                        onSelect={onSelect}
                      />
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
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    onPageChange(Math.min(totalPages - 1, page + 1))
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
  );
}

function TimelineRow({
  row,
  onSelect,
}: {
  row: InferenceHistoryRow;
  onSelect: (row: InferenceHistoryRow) => void;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelect(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(row);
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
              {formatDistanceToNow(new Date(row.created_at), {
                addSuffix: true,
              })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span className="font-mono text-xs">
              {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
            </span>
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="text-sm font-mono">{row.model}</TableCell>
      <TableCell>
        <Badge variant={taskBadgeVariant(row.task)}>{row.task}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.image_source || "\u2014"}
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
  );
}

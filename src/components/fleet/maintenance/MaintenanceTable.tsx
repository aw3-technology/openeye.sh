import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Wrench, Trash2, Repeat } from "lucide-react";
import type { MaintenanceWindowResponse } from "@/types/fleet";
import { formatDateRange } from "@/lib/format-utils";
import { getWindowStatus, statusConfig, type FilterTab } from "./constants";

interface MaintenanceTableProps {
  windows: MaintenanceWindowResponse[];
  isLoading: boolean;
  filter: FilterTab;
  onEdit: (window: MaintenanceWindowResponse) => void;
  onDelete: (id: string, name: string) => void;
  isDeleting: boolean;
}

export function MaintenanceTable({
  windows,
  isLoading,
  filter,
  onEdit,
  onDelete,
  isDeleting,
}: MaintenanceTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Recurrence</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && windows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {filter === "all"
                    ? "No maintenance windows scheduled"
                    : `No ${filter} maintenance windows`}
                </TableCell>
              </TableRow>
            )}
            {windows.map((w) => {
              const status = getWindowStatus(w);
              const cfg = statusConfig[status];
              return (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <div>{w.name}</div>
                        {w.description && (
                          <div className="text-xs text-muted-foreground max-w-xs truncate">
                            {w.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {new Date(w.starts_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {new Date(w.ends_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {formatDateRange(w.starts_at, w.ends_at)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.recurrence ? (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {w.recurrence}
                      </span>
                    ) : (
                      "One-time"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(w)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      disabled={isDeleting}
                      onClick={() => onDelete(w.id, w.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

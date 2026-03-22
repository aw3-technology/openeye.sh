import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Circle, Clock, HardDrive } from "lucide-react";
import type { ModelEntry } from "./types";

function StatusIcon({
  status,
  downloaded,
}: {
  status: "integrated" | "planned";
  downloaded: boolean;
}) {
  if (downloaded) {
    return <CheckCircle2 className="h-4 w-4 text-terminal-green" />;
  }
  if (status === "integrated") {
    return <Circle className="h-4 w-4 text-terminal-green/50" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function ModelTableRow({
  model,
  isActive,
}: {
  model: ModelEntry;
  isActive: boolean;
}) {
  return (
    <TableRow className={isActive ? "bg-terminal-green/5" : undefined}>
      <TableCell>
        <StatusIcon status={model.status} downloaded={model.downloaded} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{model.name}</span>
          {isActive && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Active
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
        {model.creator}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-mono ${model.categoryColor}`}
        >
          {model.category}
        </Badge>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
        {model.role}
      </TableCell>
      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
        {model.adapter}
      </TableCell>
      <TableCell className="text-right hidden sm:table-cell font-mono text-sm tabular-nums">
        {model.size_mb
          ? model.size_mb >= 1000
            ? `${(model.size_mb / 1000).toFixed(1)} GB`
            : `${model.size_mb} MB`
          : "—"}
      </TableCell>
    </TableRow>
  );
}

interface ModelRegistryTableProps {
  models: ModelEntry[];
  categoryFilter: string;
  activeModelKey?: string;
}

export function ModelRegistryTable({
  models,
  categoryFilter,
  activeModelKey,
}: ModelRegistryTableProps) {
  const rows = useMemo(
    () =>
      models.map((model) => ({
        model,
        isActive:
          !!activeModelKey &&
          activeModelKey.toLowerCase().includes(model.key.replace(/_/g, "")),
      })),
    [models, activeModelKey],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          {categoryFilter === "all" ? "All Models" : categoryFilter}
          <Badge variant="secondary" className="ml-auto text-xs">
            {models.length} model{models.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">Status</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="hidden md:table-cell">Creator</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="hidden lg:table-cell">Role</TableHead>
              <TableHead className="hidden sm:table-cell">Adapter</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ model, isActive }) => (
              <ModelTableRow
                key={model.key}
                model={model}
                isActive={isActive}
              />
            ))}
            {models.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No models match your filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

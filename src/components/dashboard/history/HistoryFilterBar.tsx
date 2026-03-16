import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface HistoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  modelFilter: string;
  onModelFilterChange: (model: string) => void;
  taskFilter: string;
  onTaskFilterChange: (task: string) => void;
  uniqueModels: string[];
  uniqueTasks: string[];
  onClear: () => void;
  hasFilters: boolean;
}

export function HistoryFilterBar({
  searchQuery,
  onSearchChange,
  modelFilter,
  onModelFilterChange,
  taskFilter,
  onTaskFilterChange,
  uniqueModels,
  uniqueTasks,
  onClear,
  hasFilters,
}: HistoryFilterBarProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by model, task, or object label..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={modelFilter} onValueChange={onModelFilterChange}>
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
        <Select value={taskFilter} onValueChange={onTaskFilterChange}>
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
            onClick={onClear}
            className="gap-1 h-9"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

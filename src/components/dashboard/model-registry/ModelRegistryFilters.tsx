import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ModelRegistryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "integrated" | "planned";
  onStatusFilterChange: (value: "all" | "integrated" | "planned") => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: string[];
  categoryIcons: Record<string, React.ReactNode>;
}

export function ModelRegistryFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  categoryIcons,
}: ModelRegistryFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search + status */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models, creators, tasks..."
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "integrated", "planned"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange(s)}
              className="text-xs capitalize"
            >
              {s === "all" ? "All Status" : s}
            </Button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onCategoryFilterChange(cat)}
            className="text-xs gap-1.5"
          >
            {cat !== "all" && categoryIcons[cat]}
            {cat === "all" ? "All Categories" : cat}
          </Button>
        ))}
      </div>
    </div>
  );
}

import { Search, Filter } from "lucide-react";
import { allTags, demoObservations } from "./data";

export function MemorySearchFilters({
  query,
  onQueryChange,
  timeRange,
  onTimeRangeChange,
  activeTag,
  onActiveTagChange,
  minSignificance,
  onMinSignificanceChange,
  showFilters,
  onShowFiltersChange,
  filteredCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  timeRange: string;
  onTimeRangeChange: (v: string) => void;
  activeTag: string | null;
  onActiveTagChange: (v: string | null) => void;
  minSignificance: number;
  onMinSignificanceChange: (v: number) => void;
  showFilters: boolean;
  onShowFiltersChange: (v: boolean) => void;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search observations... (e.g. 'person', 'soldering', 'hazard')"
            className="w-full pl-9 pr-4 py-2 text-sm font-mono bg-card border border-foreground/10 rounded focus:outline-none focus:border-terminal-green/50"
          />
        </div>
        <select
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value)}
          className="px-3 py-2 text-sm font-mono bg-card border border-foreground/10 rounded focus:outline-none"
        >
          <option value="all">All time</option>
          <option value="last_1h">Last 1h</option>
          <option value="last_24h">Last 24h</option>
          <option value="last_7d">Last 7d</option>
        </select>
        <button
          onClick={() => onShowFiltersChange(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-mono border rounded transition-colors ${
            showFilters || activeTag || minSignificance > 0
              ? "bg-terminal-green/10 border-terminal-green/30 text-terminal-green"
              : "bg-card border-foreground/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {(activeTag || minSignificance > 0) && (
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
          )}
        </button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="border border-foreground/5 rounded-lg bg-card p-4 space-y-4">
          {/* Tag Cloud */}
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Filter by Tag
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => onActiveTagChange(null)}
                className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                  activeTag === null
                    ? "bg-terminal-green/15 text-terminal-green border border-terminal-green/30"
                    : "bg-foreground/5 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                all
              </button>
              {allTags.map((tag) => {
                const count = demoObservations.filter((o) =>
                  o.tags.includes(tag)
                ).length;
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      onActiveTagChange(activeTag === tag ? null : tag)
                    }
                    className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                      activeTag === tag
                        ? "bg-terminal-green/15 text-terminal-green border border-terminal-green/30"
                        : "bg-foreground/5 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    {tag}{" "}
                    <span className="opacity-50">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Significance Threshold */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Min Significance
              </span>
              <span className="text-[10px] font-mono text-terminal-green tabular-nums">
                {minSignificance > 0
                  ? `>= ${(minSignificance * 100).toFixed(0)}%`
                  : "any"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={minSignificance * 100}
              onChange={(e) =>
                onMinSignificanceChange(Number(e.target.value) / 100)
              }
              className="w-full mt-2 accent-terminal-green"
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Active filter summary */}
          {(activeTag || minSignificance > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-foreground/5">
              <span className="text-[10px] font-mono text-muted-foreground">
                Showing {filteredCount} of{" "}
                {totalCount} observations
              </span>
              <button
                onClick={() => {
                  onActiveTagChange(null);
                  onMinSignificanceChange(0);
                }}
                className="text-[10px] font-mono text-terminal-red hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

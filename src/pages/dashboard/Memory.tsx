import { Brain, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { agentDemoTicks } from "@/data/agentDemoData";
import type { Observation } from "@/types/agent";

// Extract unique observations from demo data
const demoObservations: Observation[] = agentDemoTicks
  .filter((t) => t.observation)
  .map((t) => t.observation!)
  .filter((obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i);

export default function Memory() {
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredObservations = useMemo(() => {
    let results = demoObservations;

    if (query.trim()) {
      const keywords = query.toLowerCase().split(/\s+/);
      results = results.filter((obs) => {
        const text = `${obs.scene_summary} ${obs.change_description} ${obs.tags.join(" ")}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      });
    }

    if (timeRange !== "all") {
      // In demo mode just show all; in live mode this would filter by real time
      results = results;
    }

    return results;
  }, [query, timeRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-5 w-5 text-blue-400" />
        <h1 className="text-xl font-semibold">Observation Memory</h1>
        <span className="text-xs font-mono text-muted-foreground">
          {demoObservations.length} observations stored
        </span>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search observations... (e.g. 'person', 'soldering', 'hazard')"
            className="w-full pl-9 pr-4 py-2 text-sm font-mono bg-card border border-foreground/10 rounded focus:outline-none focus:border-terminal-green/50"
          />
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 text-sm font-mono bg-card border border-foreground/10 rounded focus:outline-none"
        >
          <option value="all">All time</option>
          <option value="last_1h">Last 1h</option>
          <option value="last_24h">Last 24h</option>
          <option value="last_7d">Last 7d</option>
        </select>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filteredObservations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm font-mono">
            No observations match your query.
          </div>
        ) : (
          filteredObservations.map((obs) => (
            <div
              key={obs.id}
              className="border border-foreground/5 rounded-lg bg-card overflow-hidden"
            >
              {/* Card header */}
              <button
                onClick={() => setExpandedId(expandedId === obs.id ? null : obs.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    Tick {obs.tick}
                  </span>
                  <SignificanceDot value={obs.significance} />
                  <span className="text-sm font-mono text-foreground/80 truncate">
                    {obs.scene_summary}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {obs.change_description && (
                    <span className="text-[10px] font-mono text-terminal-amber">
                      changed
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {expandedId === obs.id ? "−" : "+"}
                  </span>
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === obs.id && (
                <div className="border-t border-foreground/5 p-4 space-y-3">
                  {obs.change_description && (
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Change</span>
                      <div className="text-xs font-mono text-terminal-amber mt-0.5">
                        {obs.change_description}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      Detections ({obs.detections.length})
                    </span>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {obs.detections.map((det, i) => (
                        <div
                          key={det.track_id ?? `${det.label}-${i}`}
                          className="flex items-center justify-between text-xs font-mono px-2 py-1 bg-foreground/[0.03] rounded"
                        >
                          <span>{det.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {(det.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {obs.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {obs.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono px-1.5 py-0.5 bg-foreground/5 rounded text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-muted-foreground">
                    Significance: {(obs.significance * 100).toFixed(0)}% | ID: {obs.id}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SignificanceDot({ value }: { value: number }) {
  const color =
    value >= 0.7
      ? "bg-terminal-red"
      : value >= 0.4
        ? "bg-terminal-amber"
        : "bg-terminal-green";
  return <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}

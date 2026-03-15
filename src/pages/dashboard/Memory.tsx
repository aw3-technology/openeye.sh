import {
  Brain,
  Search,
  AlertTriangle,
  Eye,
  Tag,
  Activity,
  BarChart3,
  Zap,
  Filter,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { agentDemoTicks } from "@/data/agentDemoData";
import type { Observation } from "@/types/agent";

// Extract unique observations from demo data
const demoObservations: Observation[] = agentDemoTicks
  .filter((t) => t.observation)
  .map((t) => t.observation!)
  .filter((obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i);

// Pre-compute all unique tags
const allTags = Array.from(
  new Set(demoObservations.flatMap((obs) => obs.tags))
).sort();

// Pre-compute all unique detected object labels
const allLabels = Array.from(
  new Set(demoObservations.flatMap((obs) => obs.detections.map((d) => d.label)))
).sort();

export default function Memory() {
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [minSignificance, setMinSignificance] = useState(0);
  const [recallQuery, setRecallQuery] = useState("");
  const [recallResults, setRecallResults] = useState<Observation[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredObservations = useMemo(() => {
    let results = demoObservations;

    if (query.trim()) {
      const keywords = query.toLowerCase().split(/\s+/);
      results = results.filter((obs) => {
        const text =
          `${obs.scene_summary} ${obs.change_description} ${obs.tags.join(" ")}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      });
    }

    if (activeTag) {
      results = results.filter((obs) => obs.tags.includes(activeTag));
    }

    if (minSignificance > 0) {
      results = results.filter((obs) => obs.significance >= minSignificance);
    }

    if (timeRange !== "all") {
      // In demo mode just show all; in live mode this would filter by real time
      results = results;
    }

    return results;
  }, [query, timeRange, activeTag, minSignificance]);

  // Stats derived from all observations
  const stats = useMemo(() => {
    const highSig = demoObservations.filter((o) => o.significance >= 0.7).length;
    const withChanges = demoObservations.filter(
      (o) => o.change_description
    ).length;
    const avgSig =
      demoObservations.reduce((sum, o) => sum + o.significance, 0) /
      demoObservations.length;
    return {
      total: demoObservations.length,
      highSignificance: highSig,
      changes: withChanges,
      uniqueObjects: allLabels.length,
      uniqueTags: allTags.length,
      avgSignificance: avgSig,
    };
  }, []);

  // Simulate a recall query against the memory store
  const handleRecall = useCallback(() => {
    if (!recallQuery.trim()) {
      setRecallResults(null);
      return;
    }
    const keywords = recallQuery.toLowerCase().split(/\s+/);
    const matches = demoObservations
      .filter((obs) => {
        const text =
          `${obs.scene_summary} ${obs.change_description} ${obs.tags.join(" ")}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      })
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 5);
    setRecallResults(matches);
  }, [recallQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-blue-400" />
          <h1 className="text-xl font-semibold">Observation Memory</h1>
          <span className="text-xs font-mono text-muted-foreground">
            {demoObservations.length} observations stored
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
            online
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Observations"
          value={stats.total}
        />
        <StatCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="High Significance"
          value={stats.highSignificance}
          accent="text-terminal-red"
        />
        <StatCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Scene Changes"
          value={stats.changes}
          accent="text-terminal-amber"
        />
        <StatCard
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Avg Significance"
          value={`${(stats.avgSignificance * 100).toFixed(0)}%`}
        />
        <StatCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Unique Objects"
          value={stats.uniqueObjects}
        />
        <StatCard
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Unique Tags"
          value={stats.uniqueTags}
        />
      </div>

      {/* Significance Timeline */}
      <div className="border border-foreground/5 rounded-lg bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Significance Timeline
          </span>
        </div>
        <SignificanceTimeline
          observations={demoObservations}
          onTickClick={(obs) =>
            setExpandedId(expandedId === obs.id ? null : obs.id)
          }
          expandedId={expandedId}
        />
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
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
                  onClick={() => setActiveTag(null)}
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
                        setActiveTag(activeTag === tag ? null : tag)
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
                  setMinSignificance(Number(e.target.value) / 100)
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
                  Showing {filteredObservations.length} of{" "}
                  {demoObservations.length} observations
                </span>
                <button
                  onClick={() => {
                    setActiveTag(null);
                    setMinSignificance(0);
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

      {/* Main Content: two-column on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Observation List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Observations ({filteredObservations.length})
            </span>
          </div>

          {filteredObservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-mono border border-foreground/5 rounded-lg bg-card">
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
                  onClick={() =>
                    setExpandedId(expandedId === obs.id ? null : obs.id)
                  }
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
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Change
                        </span>
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
                          <button
                            key={tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTag(activeTag === tag ? null : tag);
                              setShowFilters(true);
                            }}
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                              activeTag === tag
                                ? "bg-terminal-green/15 text-terminal-green"
                                : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Significance bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Significance
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                          {(obs.significance * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            obs.significance >= 0.7
                              ? "bg-terminal-red"
                              : obs.significance >= 0.4
                                ? "bg-terminal-amber"
                                : "bg-terminal-green"
                          }`}
                          style={{
                            width: `${obs.significance * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-muted-foreground">
                      ID: {obs.id} | Timestamp: {new Date(obs.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar: Memory Recall + Object Tracker */}
        <div className="space-y-4">
          {/* Memory Recall Panel */}
          <div className="border border-foreground/5 rounded-lg bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Memory Recall
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              Simulate an agent recall query against the observation store.
              Returns top-5 by significance.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={recallQuery}
                onChange={(e) => setRecallQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRecall()}
                placeholder="e.g. 'soldering hazard'"
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-background border border-foreground/10 rounded focus:outline-none focus:border-blue-400/50"
              />
              <button
                onClick={handleRecall}
                className="px-3 py-1.5 text-xs font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/25 transition-colors"
              >
                Recall
              </button>
            </div>
            {recallResults !== null && (
              <div className="space-y-2 pt-2 border-t border-foreground/5">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {recallResults.length} result
                  {recallResults.length !== 1 ? "s" : ""} for &quot;{recallQuery}
                  &quot;
                </span>
                {recallResults.length === 0 ? (
                  <div className="text-[10px] font-mono text-muted-foreground py-2">
                    No matching memories found.
                  </div>
                ) : (
                  recallResults.map((obs) => (
                    <button
                      key={obs.id}
                      onClick={() =>
                        setExpandedId(
                          expandedId === obs.id ? null : obs.id
                        )
                      }
                      className="w-full text-left px-2 py-1.5 text-[10px] font-mono rounded bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-colors space-y-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <SignificanceDot value={obs.significance} />
                        <span className="text-foreground/80 truncate">
                          {obs.scene_summary}
                        </span>
                      </div>
                      <div className="text-muted-foreground pl-4">
                        Tick {obs.tick} | Sig{" "}
                        {(obs.significance * 100).toFixed(0)}%
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Object Tracker */}
          <div className="border border-foreground/5 rounded-lg bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Object Tracker
              </span>
            </div>
            <div className="space-y-1.5">
              {allLabels.map((label) => {
                const appearances = demoObservations.filter((o) =>
                  o.detections.some((d) => d.label === label)
                ).length;
                const ratio = appearances / demoObservations.length;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <button
                        onClick={() => setQuery(label)}
                        className="text-foreground/80 hover:text-terminal-green transition-colors"
                      >
                        {label}
                      </button>
                      <span className="text-muted-foreground tabular-nums">
                        {appearances}/{demoObservations.length}
                      </span>
                    </div>
                    <div className="h-1 bg-foreground/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400/50 rounded-full"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Tag Cloud */}
          <div className="border border-foreground/5 rounded-lg bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Tag Cloud
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const count = demoObservations.filter((o) =>
                  o.tags.includes(tag)
                ).length;
                const weight = count / demoObservations.length;
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setActiveTag(activeTag === tag ? null : tag);
                      setShowFilters(true);
                    }}
                    className={`font-mono px-2 py-1 rounded transition-colors ${
                      activeTag === tag
                        ? "bg-terminal-green/15 text-terminal-green border border-terminal-green/30"
                        : "bg-foreground/5 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                    style={{
                      fontSize: `${Math.max(9, Math.min(13, 9 + weight * 8))}px`,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="border border-foreground/5 rounded-lg bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={`text-lg font-mono font-semibold tabular-nums ${accent ?? "text-foreground"}`}
      >
        {value}
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

function SignificanceTimeline({
  observations,
  onTickClick,
  expandedId,
}: {
  observations: Observation[];
  onTickClick: (obs: Observation) => void;
  expandedId: string | null;
}) {
  const maxTick = Math.max(...observations.map((o) => o.tick));

  return (
    <div className="relative pb-5">
    <div className="flex items-end gap-px h-16">
      {observations.map((obs) => {
        const heightPct = Math.max(8, obs.significance * 100);
        const isActive = expandedId === obs.id;
        const barColor =
          obs.significance >= 0.7
            ? "bg-terminal-red"
            : obs.significance >= 0.4
              ? "bg-terminal-amber"
              : "bg-terminal-green";
        return (
          <button
            key={obs.id}
            onClick={() => onTickClick(obs)}
            className={`relative flex-1 rounded-t transition-all group ${
              isActive ? "ring-1 ring-terminal-green" : ""
            }`}
            style={{ height: `${heightPct}%` }}
            title={`Tick ${obs.tick}: ${obs.scene_summary} (${(obs.significance * 100).toFixed(0)}%)`}
          >
            <div
              className={`absolute inset-0 rounded-t ${barColor} ${
                isActive ? "opacity-100" : "opacity-60 group-hover:opacity-90"
              } transition-opacity`}
            />
            {/* Tick label on hover */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              T{obs.tick}
            </div>
          </button>
        );
      })}
    </div>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] font-mono text-muted-foreground pointer-events-none">
        <span>T1</span>
        <span>T{maxTick}</span>
      </div>
    </div>
  );
}

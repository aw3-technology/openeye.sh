import { Brain, Activity } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import type { Observation } from "@/types/agent";
import { demoObservations, allTags, allLabels } from "@/components/dashboard/memory/data";
import { MemoryStatsRow } from "@/components/dashboard/memory/MemoryStatsRow";
import { SignificanceTimeline } from "@/components/dashboard/memory/SignificanceTimeline";
import { MemorySearchFilters } from "@/components/dashboard/memory/MemorySearchFilters";
import { ObservationList } from "@/components/dashboard/memory/ObservationList";
import { MemorySidebar } from "@/components/dashboard/memory/MemorySidebar";

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
      results = results;
    }

    return results;
  }, [query, timeRange, activeTag, minSignificance]);

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

  const toggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    []
  );

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

      <MemoryStatsRow stats={stats} />

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
          onTickClick={(obs) => toggleExpand(obs.id)}
          expandedId={expandedId}
        />
      </div>

      <MemorySearchFilters
        query={query}
        onQueryChange={setQuery}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        activeTag={activeTag}
        onActiveTagChange={setActiveTag}
        minSignificance={minSignificance}
        onMinSignificanceChange={setMinSignificance}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        filteredCount={filteredObservations.length}
        totalCount={demoObservations.length}
      />

      {/* Main Content: two-column on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ObservationList
          observations={filteredObservations}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          activeTag={activeTag}
          onActiveTagChange={setActiveTag}
          onShowFilters={() => setShowFilters(true)}
        />

        <MemorySidebar
          recallQuery={recallQuery}
          onRecallQueryChange={setRecallQuery}
          onRecall={handleRecall}
          recallResults={recallResults}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          activeTag={activeTag}
          onActiveTagChange={setActiveTag}
          onShowFilters={() => setShowFilters(true)}
          onSearchByLabel={setQuery}
        />
      </div>
    </div>
  );
}

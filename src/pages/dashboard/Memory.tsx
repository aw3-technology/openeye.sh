import { Brain, Activity, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import type { Observation } from "@/types/agent";
import { tagsOf, labelsOf } from "@/components/dashboard/memory/data";
import { useObservations } from "@/hooks/useObservations";
import { MemoryStatsRow } from "@/components/dashboard/memory/MemoryStatsRow";
import { SignificanceTimeline } from "@/components/dashboard/memory/SignificanceTimeline";
import { MemorySearchFilters } from "@/components/dashboard/memory/MemorySearchFilters";
import { ObservationList } from "@/components/dashboard/memory/ObservationList";
import { MemorySidebar } from "@/components/dashboard/memory/MemorySidebar";

const TIME_RANGE_MS: Record<string, number> = {
  last_1h: 60 * 60 * 1000,
  last_24h: 24 * 60 * 60 * 1000,
  last_7d: 7 * 24 * 60 * 60 * 1000,
};

const EMPTY: Observation[] = [];

export default function Memory() {
  const { data, isLoading, error } = useObservations();
  const observations = data?.observations ?? EMPTY;
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [minSignificance, setMinSignificance] = useState(0);
  const [recallQuery, setRecallQuery] = useState("");
  const [recallResults, setRecallResults] = useState<Observation[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredObservations = useMemo(() => {
    let results = observations;

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

    const windowMs = TIME_RANGE_MS[timeRange];
    if (windowMs) {
      const since = Date.now() - windowMs;
      results = results.filter((obs) => new Date(obs.timestamp).getTime() >= since);
    }

    return results;
  }, [observations, query, timeRange, activeTag, minSignificance]);

  const stats = useMemo(() => {
    const highSig = observations.filter((o) => o.significance >= 0.7).length;
    const withChanges = observations.filter((o) => o.change_description).length;
    const avgSig = observations.length
      ? observations.reduce((sum, o) => sum + o.significance, 0) / observations.length
      : 0;
    return {
      total: observations.length,
      highSignificance: highSig,
      changes: withChanges,
      uniqueObjects: labelsOf(observations).length,
      uniqueTags: tagsOf(observations).length,
      avgSignificance: avgSig,
    };
  }, [observations]);

  const handleRecall = useCallback(() => {
    if (!recallQuery.trim()) {
      setRecallResults(null);
      return;
    }
    const keywords = recallQuery.toLowerCase().split(/\s+/);
    const matches = observations
      .filter((obs) => {
        const text =
          `${obs.scene_summary} ${obs.change_description} ${obs.tags.join(" ")}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      })
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 5);
    setRecallResults(matches);
  }, [observations, recallQuery]);

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
            {observations.length} observations stored
          </span>
        </div>
        {data?.isSample && (
          <span className="rounded-full border border-foreground/10 px-2.5 py-0.5 text-xs text-muted-foreground">
            Sample session
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading observations…
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">Couldn't load observations: {(error as Error).message}</p>
      )}
      {!isLoading && !error && observations.length === 0 && (
        <div className="rounded-lg border border-foreground/5 bg-card p-8 text-center">
          <p className="font-medium">No observations yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Observations are saved here when you run the agent loop in live mode against your OpenEye server.
          </p>
          <Link to="/dashboard/agent" className="mt-4 inline-block text-sm text-primary hover:underline">
            Open the agent loop
          </Link>
        </div>
      )}

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
          observations={observations}
          onTickClick={(obs) => toggleExpand(obs.id)}
          expandedId={expandedId}
        />
      </div>

      <MemorySearchFilters
        observations={observations}
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
        totalCount={observations.length}
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
          observations={observations}
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

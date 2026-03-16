import { Brain, Eye, Tag } from "lucide-react";
import type { Observation } from "@/types/agent";
import { allTags, allLabels, demoObservations } from "./data";
import { SignificanceDot } from "./SignificanceDot";

export function MemorySidebar({
  recallQuery,
  onRecallQueryChange,
  onRecall,
  recallResults,
  expandedId,
  onToggleExpand,
  activeTag,
  onActiveTagChange,
  onShowFilters,
  onSearchByLabel,
}: {
  recallQuery: string;
  onRecallQueryChange: (v: string) => void;
  onRecall: () => void;
  recallResults: Observation[] | null;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  activeTag: string | null;
  onActiveTagChange: (v: string | null) => void;
  onShowFilters: () => void;
  onSearchByLabel: (label: string) => void;
}) {
  return (
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
            onChange={(e) => onRecallQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRecall()}
            placeholder="e.g. 'soldering hazard'"
            className="flex-1 px-3 py-1.5 text-xs font-mono bg-background border border-foreground/10 rounded focus:outline-none focus:border-blue-400/50"
          />
          <button
            onClick={onRecall}
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
                  onClick={() => onToggleExpand(obs.id)}
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
                    onClick={() => onSearchByLabel(label)}
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
                  onActiveTagChange(activeTag === tag ? null : tag);
                  onShowFilters();
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
  );
}

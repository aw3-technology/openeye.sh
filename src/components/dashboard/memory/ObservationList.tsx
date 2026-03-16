import type { Observation } from "@/types/agent";
import { SignificanceDot } from "./SignificanceDot";

export function ObservationList({
  observations,
  expandedId,
  onToggleExpand,
  activeTag,
  onActiveTagChange,
  onShowFilters,
}: {
  observations: Observation[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  activeTag: string | null;
  onActiveTagChange: (v: string | null) => void;
  onShowFilters: () => void;
}) {
  return (
    <div className="lg:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Observations ({observations.length})
        </span>
      </div>

      {observations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm font-mono border border-foreground/5 rounded-lg bg-card">
          No observations match your query.
        </div>
      ) : (
        observations.map((obs) => (
          <div
            key={obs.id}
            className="border border-foreground/5 rounded-lg bg-card overflow-hidden"
          >
            {/* Card header */}
            <button
              onClick={() => onToggleExpand(obs.id)}
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
                  {expandedId === obs.id ? "\u2212" : "+"}
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
                          onActiveTagChange(activeTag === tag ? null : tag);
                          onShowFilters();
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
  );
}

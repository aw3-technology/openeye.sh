import type { Observation } from "@/types/agent";

interface PlanPanelProps {
  plan: string[];
  memories: Observation[];
  planChanged: boolean;
}

export function PlanPanel({ plan, memories, planChanged }: PlanPanelProps) {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Current Plan */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
          {planChanged && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-terminal-amber/15 text-terminal-amber border border-terminal-amber/30 rounded">
              UPDATED
            </span>
          )}
        </div>

        {plan.length === 0 ? (
          <div className="text-xs text-muted-foreground font-mono">No plan yet</div>
        ) : (
          <ul className="space-y-1">
            {plan.map((step, i) => (
              <li key={`${step.slice(0, 30)}-${i}`} className="flex items-start gap-2 text-xs font-mono">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span
                  className={
                    step.startsWith("ALERT")
                      ? "text-terminal-amber"
                      : "text-foreground/80"
                  }
                >
                  {step}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Memory Timeline */}
      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-semibold text-foreground mb-3">Memory Timeline</h3>

        <div className="overflow-y-auto max-h-[300px] space-y-2 scrollbar-thin">
          {memories.length === 0 ? (
            <div className="text-xs text-muted-foreground font-mono">No observations stored</div>
          ) : (
            memories
              .slice(-10)
              .reverse()
              .map((obs) => (
                <div
                  key={obs.id}
                  className="border border-foreground/5 rounded p-2 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Tick {obs.tick}
                    </span>
                    <SignificanceIndicator value={obs.significance} />
                  </div>
                  <div className="text-xs font-mono text-foreground/80 truncate">
                    {obs.scene_summary}
                  </div>
                  {obs.change_description && (
                    <div className="text-[10px] font-mono text-terminal-amber truncate">
                      {obs.change_description}
                    </div>
                  )}
                  {obs.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {obs.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono px-1 py-0.5 bg-foreground/5 rounded text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

function SignificanceIndicator({ value }: { value: number }) {
  const color =
    value >= 0.7
      ? "bg-terminal-red"
      : value >= 0.4
        ? "bg-terminal-amber"
        : "bg-terminal-green";

  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

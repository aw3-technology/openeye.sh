import { useEffect, useRef } from "react";
import type { AgentTickEvent } from "@/types/agent";

const phaseColors: Record<string, string> = {
  perceive: "text-terminal-green",
  recall: "text-terminal-fg",
  reason: "text-terminal-amber",
  act: "text-terminal-red",
};

const phaseBg: Record<string, string> = {
  perceive: "bg-terminal-green/15 border-terminal-green/30",
  recall: "bg-terminal-fg/10 border-terminal-fg/20",
  reason: "bg-terminal-amber/15 border-terminal-amber/30",
  act: "bg-terminal-red/15 border-terminal-red/30",
};

function getTickSummary(event: AgentTickEvent): string {
  switch (event.phase) {
    case "perceive":
      return event.observation?.scene_summary || "Capturing frame...";
    case "recall":
      return `Recalled ${event.memory_recalled.length} observation(s)`;
    case "reason":
      return event.reasoning?.chain_of_thought || "Reasoning...";
    case "act":
      return event.action_taken || "No action";
    default:
      return "";
  }
}

interface ReasoningLogProps {
  ticks: AgentTickEvent[];
}

export function ReasoningLog({ ticks }: ReasoningLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticks.length]);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-foreground mb-3">Reasoning Log</h3>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px] max-h-[500px] scrollbar-thin"
      >
        {ticks.length === 0 && (
          <div className="text-xs text-muted-foreground font-mono py-8 text-center">
            Start the agent to see reasoning events...
          </div>
        )}

        {ticks.map((event, i) => (
          <div
            key={`${event.tick}-${event.phase}-${i}`}
            className="flex items-start gap-2 text-xs font-mono"
          >
            {/* Tick badge */}
            <span className="text-muted-foreground shrink-0 w-8 text-right tabular-nums">
              {event.tick}
            </span>

            {/* Phase badge */}
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${phaseBg[event.phase] || ""}`}
            >
              <span className={phaseColors[event.phase] || ""}>{event.phase}</span>
            </span>

            {/* Summary */}
            <span className="text-foreground/80 break-words min-w-0">
              {getTickSummary(event)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

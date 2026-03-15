import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentTickEvent } from "@/types/agent";

const phaseConfig: Record<string, { color: string; bg: string; border: string }> = {
  perceive: {
    color: "text-terminal-green",
    bg: "bg-terminal-green/15",
    border: "border-terminal-green/30",
  },
  recall: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  reason: {
    color: "text-terminal-amber",
    bg: "bg-terminal-amber/15",
    border: "border-terminal-amber/30",
  },
  act: {
    color: "text-orange-400",
    bg: "bg-orange-400/15",
    border: "border-orange-400/30",
  },
};

function getTickSummary(event: AgentTickEvent): string {
  switch (event.phase) {
    case "perceive":
      return event.observation?.scene_summary || "Capturing frame...";
    case "recall":
      return `Recalled ${event.memory_recalled.length} observation(s)`;
    case "reason":
      return event.reasoning?.decided_action || event.reasoning?.chain_of_thought || "Reasoning...";
    case "act":
      return event.action_taken || "No action";
    default:
      return "";
  }
}

interface ReasoningLogProps {
  ticks: AgentTickEvent[];
  currentTick?: AgentTickEvent | null;
}

export function ReasoningLog({ ticks, currentTick }: ReasoningLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticks.length]);

  // Current reasoning context (from the latest tick with reasoning)
  const latestReasoning = [...ticks]
    .reverse()
    .find((t) => t.reasoning)?.reasoning;

  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <MessageSquare className="h-4 w-4" />
          REASONING LOG
          <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30 tabular-nums">
            {ticks.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Current reasoning summary */}
        <AnimatePresence mode="wait">
          {latestReasoning && (
            <motion.div
              key={latestReasoning.chain_of_thought?.slice(0, 30)}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 p-2 rounded-md bg-terminal-amber/5 border border-terminal-amber/15"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="h-3 w-3 text-terminal-amber" />
                <span className="text-[10px] font-mono text-terminal-amber uppercase tracking-wider">
                  Current Reasoning
                </span>
                {latestReasoning.plan_changed && (
                  <Badge variant="outline" className="text-[9px] border-terminal-amber/30 text-terminal-amber ml-auto">
                    PLAN UPDATED
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground/70 font-mono line-clamp-2">
                {latestReasoning.observation_summary}
              </p>
              {latestReasoning.memory_context && (
                <p className="text-[10px] text-muted-foreground font-mono mt-1 line-clamp-1">
                  Memory: {latestReasoning.memory_context}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event timeline */}
        <ScrollArea className="max-h-[380px]">
          <div ref={scrollRef} className="space-y-1">
            {ticks.length === 0 && (
              <div className="text-xs text-muted-foreground font-mono py-8 text-center">
                Start the agent to see reasoning events...
              </div>
            )}

            {ticks.map((event, i) => {
              const cfg = phaseConfig[event.phase] ?? phaseConfig.perceive;
              const isLatest = i === ticks.length - 1;

              return (
                <motion.div
                  key={`${event.tick}-${event.phase}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: isLatest ? 1 : 0.7, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2 text-xs font-mono py-1 px-1.5 rounded ${
                    isLatest ? "bg-muted/40" : ""
                  }`}
                >
                  {/* Tick number */}
                  <span className="text-muted-foreground shrink-0 w-6 text-right tabular-nums">
                    {event.tick}
                  </span>

                  {/* Phase badge */}
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${cfg.bg} ${cfg.border}`}
                  >
                    <span className={cfg.color}>{event.phase}</span>
                  </span>

                  {/* Summary */}
                  <span className="text-foreground/80 break-words min-w-0 line-clamp-2">
                    {getTickSummary(event)}
                  </span>

                  {/* Plan changed indicator */}
                  {event.reasoning?.plan_changed && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-terminal-amber mt-1.5" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

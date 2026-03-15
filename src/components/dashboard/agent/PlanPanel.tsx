import { motion, AnimatePresence } from "framer-motion";
import { ListChecks, Clock, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Observation } from "@/types/agent";

interface PlanPanelProps {
  plan: string[];
  memories: Observation[];
  planChanged: boolean;
  actionTaken?: string;
  isRunning?: boolean;
}

export function PlanPanel({
  plan,
  memories,
  planChanged,
  actionTaken = "",
  isRunning = false,
}: PlanPanelProps) {
  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <Card className={`border-terminal-green/20 ${planChanged ? "ring-1 ring-terminal-amber/30" : ""}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
            <ListChecks className="h-4 w-4" />
            CURRENT PLAN
            {planChanged && (
              <Badge variant="outline" className="ml-auto text-[10px] border-terminal-amber/30 text-terminal-amber animate-pulse">
                UPDATED
              </Badge>
            )}
            {!planChanged && plan.length > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30 tabular-nums">
                {plan.length} steps
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan.length === 0 ? (
            <div className="text-xs text-muted-foreground font-mono py-4 text-center">
              {isRunning ? "Generating plan..." : "No plan yet"}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-1.5">
                {plan.map((step, i) => {
                  const isAlert = step.startsWith("ALERT");
                  return (
                    <motion.div
                      key={`${step.slice(0, 30)}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-start gap-2 text-xs font-mono py-1.5 px-2 rounded ${
                        isAlert
                          ? "bg-terminal-amber/10 border border-terminal-amber/20"
                          : "bg-muted/30"
                      }`}
                    >
                      {isAlert ? (
                        <AlertTriangle className="h-3 w-3 text-terminal-amber shrink-0 mt-0.5" />
                      ) : (
                        <span className="text-muted-foreground shrink-0 w-4 text-right">{i + 1}.</span>
                      )}
                      <span className={isAlert ? "text-terminal-amber" : "text-foreground/80"}>
                        {step}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}

          {/* Action taken */}
          <AnimatePresence>
            {actionTaken && isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded bg-terminal-green/5 border border-terminal-green/15"
              >
                <Zap className="h-3 w-3 text-terminal-green shrink-0" />
                <span className="text-[10px] font-mono text-terminal-green/70">ACTION:</span>
                <span className="text-xs font-mono text-foreground/70 truncate">{actionTaken}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Memory Timeline */}
      <Card className="border-terminal-green/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
            <Clock className="h-4 w-4" />
            MEMORY TIMELINE
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30 tabular-nums">
              {memories.length} obs
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px]">
            {memories.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono py-4 text-center">
                {isRunning ? "Collecting observations..." : "No observations stored"}
              </div>
            ) : (
              <div className="relative pl-4 border-l border-terminal-green/20 space-y-3">
                {memories
                  .slice(-10)
                  .reverse()
                  .map((obs, i) => (
                    <motion.div
                      key={obs.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="relative"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border-2 ${
                          obs.significance >= 0.7
                            ? "bg-terminal-red border-terminal-red/50"
                            : obs.significance >= 0.4
                              ? "bg-terminal-amber border-terminal-amber/50"
                              : "bg-terminal-green border-terminal-green/50"
                        }`}
                      />

                      <div className="p-2 rounded bg-muted/30 space-y-1.5">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Tick {obs.tick}
                          </span>
                          <SignificanceBar value={obs.significance} />
                        </div>

                        {/* Scene summary */}
                        <div className="text-xs font-mono text-foreground/80 truncate">
                          {obs.scene_summary}
                        </div>

                        {/* Change description */}
                        {obs.change_description && (
                          <div className="text-[10px] font-mono text-terminal-amber truncate">
                            {obs.change_description}
                          </div>
                        )}

                        {/* Tags */}
                        {obs.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {obs.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                                  tag === "person"
                                    ? "bg-terminal-amber/15 text-terminal-amber border border-terminal-amber/20"
                                    : tag.includes("soldering") || tag.includes("knife")
                                      ? "bg-terminal-red/15 text-terminal-red border border-terminal-red/20"
                                      : "bg-foreground/5 text-muted-foreground"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SignificanceBar({ value }: { value: number }) {
  const color =
    value >= 0.7
      ? "bg-terminal-red"
      : value >= 0.4
        ? "bg-terminal-amber"
        : "bg-terminal-green";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground tabular-nums w-7 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

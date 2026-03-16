import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight } from "lucide-react";
import { priorityColor, priorityBadge } from "./utils";
import type { AgenticFrame } from "./types";

interface ActionPlanPanelProps {
  latestFrame: AgenticFrame | null;
  running: boolean;
}

export function ActionPlanPanel({ latestFrame, running }: ActionPlanPanelProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <ChevronRight className="h-4 w-4" />
          ACTION PLAN
          {latestFrame && (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
              {latestFrame.action_plan.length} steps
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="popLayout">
          {latestFrame?.action_plan && latestFrame.action_plan.length > 0 ? (
            <div className="space-y-2">
              {latestFrame.action_plan
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 5)
                .map((step, i) => (
                  <motion.div
                    key={`${step.action}-${step.target_id}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50"
                  >
                    <span className={`font-mono text-xs font-bold mt-0.5 ${priorityColor(step.priority)}`}>
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={priorityBadge(step.priority) as "default" | "secondary" | "destructive"}
                          className="text-[10px] uppercase"
                        >
                          {step.action.replace(/_/g, " ")}
                        </Badge>
                        {step.target_id && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            target: {step.target_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {step.reason}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Progress
                        value={step.priority * 100}
                        className="w-12 h-1.5"
                      />
                    </div>
                  </motion.div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-mono py-4 text-center">
              {running ? "Analyzing scene..." : "Start agent to generate action plan"}
            </p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import type { AgenticFrame } from "@/types/agentic";
import { formatTimeAgo } from "./constants";

interface ObservationTimelineProps {
  frame: AgenticFrame | null;
  running: boolean;
}

export function ObservationTimeline({ frame, running }: ObservationTimelineProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Clock className="h-4 w-4" />
          OBSERVATION TIMELINE
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-60">
          {frame?.memory?.timeline && frame.memory.timeline.length > 0 ? (
            <div className="relative pl-4 border-l border-terminal-green/20 space-y-3">
              {[...frame.memory.timeline].reverse().map((evt, i) => (
                <motion.div
                  key={`${evt.timestamp}-${i}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative"
                >
                  <div
                    className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                      evt.event === "goal_updated"
                        ? "bg-terminal-amber border-terminal-amber/50"
                        : evt.event === "vlm_reasoning"
                        ? "bg-terminal-amber border-terminal-amber/30"
                        : evt.event === "object_appeared"
                        ? "bg-terminal-green border-terminal-green/50"
                        : evt.event === "object_disappeared"
                        ? "bg-terminal-red border-terminal-red/50"
                        : "bg-muted-foreground border-muted-foreground/30"
                    }`}
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase tracking-wider"
                      >
                        {evt.event.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatTimeAgo(evt.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {evt.details}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-mono py-4 text-center">
              {running ? "Collecting observations..." : "No observations yet"}
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

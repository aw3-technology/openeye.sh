import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, Eye } from "lucide-react";
import { formatTimeAgo } from "./utils";
import type { AgenticFrame } from "./types";

interface MemoryPanelProps {
  latestFrame: AgenticFrame | null;
  running: boolean;
}

export function ObjectMemoryPanel({ latestFrame, running }: MemoryPanelProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Eye className="h-4 w-4" />
          OBJECT MEMORY
          {latestFrame?.memory && (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
              {latestFrame.memory.total_objects_tracked} tracked
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestFrame?.memory?.objects_seen &&
        Object.keys(latestFrame.memory.objects_seen).length > 0 ? (
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {Object.entries(latestFrame.memory.objects_seen).map(
                ([trackId, info]) => (
                  <div
                    key={trackId}
                    className="flex items-center justify-between py-1 px-2 rounded bg-muted/30 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-terminal-green shrink-0" />
                      <span>{info.label}</span>
                      <span className="text-[9px] text-muted-foreground">#{trackId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{info.frames_seen}f</span>
                      <span>{info.seconds_tracked.toFixed(1)}s</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground font-mono py-4 text-center">
            {running ? "Waiting for detections..." : "No objects tracked yet"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ObservationTimeline({ latestFrame, running }: MemoryPanelProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Clock className="h-4 w-4" />
          OBSERVATION TIMELINE
          {latestFrame?.memory?.timeline && latestFrame.memory.timeline.length > 0 && (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
              {latestFrame.memory.timeline.length} events
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-60">
          {latestFrame?.memory?.timeline && latestFrame.memory.timeline.length > 0 ? (
            <div className="relative pl-4 border-l border-terminal-green/20 space-y-3">
              {[...latestFrame.memory.timeline].reverse().map((evt, i) => (
                <motion.div
                  key={`${evt.timestamp}-${i}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative"
                >
                  {/* Dot */}
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

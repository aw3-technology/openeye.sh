import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, CheckCircle2 } from "lucide-react";
import type { AgenticFrame } from "@/types/agentic";

interface ObjectMemoryCardProps {
  frame: AgenticFrame | null;
  running: boolean;
}

export function ObjectMemoryCard({ frame, running }: ObjectMemoryCardProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Eye className="h-4 w-4" />
          OBJECT MEMORY
          {frame?.memory && (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
              {frame.memory.total_objects_tracked} tracked
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {frame?.memory?.objects_seen &&
        Object.keys(frame.memory.objects_seen).length > 0 ? (
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {Object.entries(frame.memory.objects_seen).map(
                ([trackId, info]) => (
                  <div
                    key={trackId}
                    className="flex items-center justify-between py-1 px-2 rounded bg-muted/30 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-terminal-green shrink-0" />
                      <span>{info.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{info.frames_seen}f</span>
                      <span>{info.seconds_tracked}s</span>
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

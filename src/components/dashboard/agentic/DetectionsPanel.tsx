import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from "lucide-react";
import type { AgenticFrame } from "./types";

interface DetectionsPanelProps {
  latestFrame: AgenticFrame | null;
  running: boolean;
  detectionCount: number;
}

export function DetectionsPanel({ latestFrame, running, detectionCount }: DetectionsPanelProps) {
  return (
    <Card className="border-terminal-green/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
          <Eye className="h-4 w-4" />
          LIVE DETECTIONS
          {detectionCount > 0 && (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
              {detectionCount} detected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestFrame?.detections && latestFrame.detections.length > 0 ? (
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {latestFrame.detections.map((det) => {
                const conf = det.confidence * 100;
                const isManipulable = det.is_manipulable;
                return (
                  <div
                    key={det.track_id}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-md font-mono text-xs ${
                      isManipulable
                        ? "bg-terminal-amber/5 border border-terminal-amber/10"
                        : "bg-foreground/5 border border-foreground/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isManipulable ? "bg-terminal-amber" : "bg-terminal-green"
                        }`}
                      />
                      <span className={isManipulable ? "text-terminal-amber" : ""}>
                        {det.label}
                      </span>
                      {isManipulable && (
                        <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                          graspable
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        #{det.track_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            conf > 80
                              ? "bg-terminal-green"
                              : conf > 50
                              ? "bg-terminal-amber"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${conf}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-muted-foreground w-12 text-right">
                        {conf.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground font-mono py-4 text-center">
            {running ? "Scanning for objects..." : "Start agent to see detections"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

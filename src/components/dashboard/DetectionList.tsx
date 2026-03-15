import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import type { DetectedObject } from "@/types/openeye";

interface DetectionListProps {
  objects: DetectedObject[];
  isStreaming: boolean;
}

export function DetectionList({ objects, isStreaming }: DetectionListProps) {
  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-terminal-green" />
            <CardTitle className="text-sm">Live Detections</CardTitle>
          </div>
          {objects.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {objects.length} detected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {objects.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono py-4 text-center">
            {isStreaming ? "No objects detected yet..." : "Start camera to see detections."}
          </p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {objects.map((obj, i) => {
              const isPerson = obj.label.toLowerCase() === "person";
              const isHazard = obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
              const confidence = obj.confidence * 100;

              return (
                <div
                  key={`${obj.label}-${i}`}
                  className={`flex items-center justify-between font-mono text-xs py-1.5 px-2 rounded-md ${
                    isHazard
                      ? "bg-terminal-amber/5 border border-terminal-amber/10"
                      : isPerson
                        ? "bg-purple-500/5 border border-purple-500/10"
                        : "bg-foreground/5 border border-foreground/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isHazard ? "bg-terminal-amber" : isPerson ? "bg-purple-400" : "bg-terminal-green"
                      }`}
                    />
                    <span className={isHazard ? "text-terminal-amber" : isPerson ? "text-purple-400" : ""}>
                      {obj.label}
                    </span>
                    {isHazard && (
                      <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                        hazard
                      </span>
                    )}
                    {isPerson && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                        {obj.bbox.h > 0.6 ? "CLOSE" : obj.bbox.h > 0.3 ? "MED" : "FAR"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          confidence > 80
                            ? "bg-terminal-green"
                            : confidence > 50
                              ? "bg-terminal-amber"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground w-12 text-right">
                      {confidence.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

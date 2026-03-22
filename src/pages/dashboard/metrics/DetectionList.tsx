import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu } from "lucide-react";

interface DetectedObject {
  label: string;
  confidence: number;
}

interface DetectionListProps {
  objects: DetectedObject[];
}

export function DetectionList({ objects }: DetectionListProps) {
  if (objects.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5" />
            Current Detections
          </span>
          <Badge variant="secondary" className="tabular-nums text-xs">
            {objects.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {objects.map((obj, i) => (
            <div
              key={`${obj.label}-${i}`}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium truncate">{obj.label}</span>
              <Badge
                variant="outline"
                className={`tabular-nums text-xs font-mono ${
                  obj.confidence >= 0.8
                    ? "text-terminal-green border-terminal-green/30"
                    : obj.confidence >= 0.5
                      ? "text-terminal-amber border-terminal-amber/30"
                      : "text-red-400 border-red-400/30"
                }`}
              >
                {(obj.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

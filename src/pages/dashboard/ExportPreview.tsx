import { CheckCircle2 } from "lucide-react";
import type { DetectedObject } from "@/types/openeye";

interface ExportPreviewProps {
  objects: DetectedObject[];
}

export function ExportPreview({ objects }: ExportPreviewProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Detected Objects ({objects.length})
      </p>
      {objects.length === 0 ? (
        <p className="text-xs text-muted-foreground">No detections.</p>
      ) : (
        <div className="grid gap-1 max-h-[200px] overflow-auto">
          {objects.map((obj, i) => (
            <div
              key={`${obj.label}-${i}`}
              className="flex items-center justify-between px-2 py-1 rounded text-xs font-mono bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-3 w-3 ${
                    obj.confidence >= 0.5 ? "text-green-500" : "text-amber-500"
                  }`}
                />
                <span>{obj.label}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {(obj.confidence * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

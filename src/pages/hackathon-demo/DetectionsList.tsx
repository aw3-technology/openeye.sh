import { Eye } from "lucide-react";
import type { AgenticFrame } from "./constants";

export function DetectionsList({
  agenticFrame,
}: {
  agenticFrame: AgenticFrame | null;
}) {
  if (!agenticFrame?.detections || agenticFrame.detections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-wider">
        <Eye className="h-3.5 w-3.5" />
        <span>Detections</span>
        <span className="ml-auto tabular-nums">
          {agenticFrame.detections.length}
        </span>
      </div>
      <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin">
        {agenticFrame.detections.slice(0, 8).map((det) => (
          <div
            key={det.track_id}
            className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white/5"
          >
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${det.is_manipulable ? "bg-amber-400" : "bg-emerald-400"}`}
              />
              <span className="text-white/70">{det.label}</span>
              <span className="text-white/20">#{det.track_id}</span>
            </div>
            <span className="text-white/30 tabular-nums">
              {(det.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

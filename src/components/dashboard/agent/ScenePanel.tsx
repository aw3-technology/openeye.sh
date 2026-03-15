import type { DetectedObject } from "@/types/openeye";

interface ScenePanelProps {
  detections: DetectedObject[];
  tickNumber: number;
  sceneSummary: string;
}

export function ScenePanel({ detections, tickNumber, sceneSummary }: ScenePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Scene View</h3>
        <span className="text-xs font-mono text-muted-foreground">Tick {tickNumber}</span>
      </div>

      {/* Detection overlay area */}
      <div className="relative bg-foreground rounded-lg overflow-hidden flex-1 min-h-[200px]">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />

        {detections.map((obj, i) => {
          const isHazard =
            obj.label.toLowerCase().includes("soldering") ||
            obj.label.toLowerCase().includes("knife") ||
            obj.confidence < 0.5;

          return (
            <div
              key={`${obj.label}-${i}`}
              className="absolute"
              style={{
                left: `${obj.bbox.x * 100}%`,
                top: `${obj.bbox.y * 100}%`,
                width: `${obj.bbox.w * 100}%`,
                height: `${obj.bbox.h * 100}%`,
              }}
            >
              <div
                className={`w-full h-full border-[0.5px] ${
                  isHazard
                    ? "border-terminal-amber bg-terminal-amber/10"
                    : "border-terminal-green bg-terminal-green/10"
                }`}
              />
              <span
                className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 tabular-nums ${
                  isHazard
                    ? "bg-terminal-amber text-foreground"
                    : "bg-terminal-green text-primary-foreground"
                }`}
              >
                {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
              </span>
              <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
              <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
              <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
              <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
            </div>
          );
        })}
      </div>

      {/* Scene summary */}
      <div className="mt-2 text-xs font-mono text-muted-foreground truncate">
        {sceneSummary || "Waiting for perception..."}
      </div>
    </div>
  );
}

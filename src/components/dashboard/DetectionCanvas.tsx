import type { DetectedObject } from "@/types/openeye";

interface DetectionCanvasProps {
  objects: DetectedObject[];
  imageUrl?: string;
  className?: string;
}

// Tailwind safelist: these classes must appear as full strings for the purge scanner.
// border-terminal-green bg-terminal-green/10 border-terminal-amber bg-terminal-amber/10
// bg-terminal-green bg-terminal-amber

export function DetectionCanvas({ objects, imageUrl, className = "" }: DetectionCanvasProps) {
  return (
    <div className={`relative bg-foreground rounded-lg overflow-hidden ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="Detection input" className="w-full h-full object-contain" />
      ) : (
        <div className="aspect-video bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />
      )}

      {/* Bounding box overlays */}
      {objects.map((obj, i) => {
        const isHazard = obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;

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
            {/* Corner markers */}
            <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
            <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
            <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
            <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${isHazard ? "border-terminal-amber" : "border-terminal-green"}`} />
          </div>
        );
      })}
    </div>
  );
}

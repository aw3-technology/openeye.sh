import type { AgenticDetection } from "./constants";

export function DetectionOverlay({
  detections,
}: {
  detections: AgenticDetection[];
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {detections.map((det) => {
        const x = "x" in det.bbox ? det.bbox.x : det.bbox.x1;
        const y = "y" in det.bbox ? det.bbox.y : det.bbox.y1;
        const w =
          "w" in det.bbox ? det.bbox.w : det.bbox.x2 - det.bbox.x1;
        const h =
          "h" in det.bbox ? det.bbox.h : det.bbox.y2 - det.bbox.y1;
        const border = det.is_manipulable
          ? "border-amber-400"
          : "border-cyan-400/60";
        const bg = det.is_manipulable
          ? "bg-amber-400/10"
          : "bg-cyan-400/5";
        const corner = det.is_manipulable
          ? "border-amber-400"
          : "border-cyan-400";
        return (
          <div
            key={det.track_id}
            className="absolute"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
            }}
          >
            <div className={`w-full h-full border ${border} ${bg}`} />
            <div
              className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${corner}`}
            />
            <div
              className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${corner}`}
            />
            <div
              className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${corner}`}
            />
            <div
              className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${corner}`}
            />
          </div>
        );
      })}
    </div>
  );
}

import { useMemo } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import {
  PERSON_DANGER_THRESHOLD,
  PERSON_CAUTION_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/safety-thresholds";

export function MetricsBar() {
  const { metrics, latestResult } = useOpenEyeStream();

  const overallSafety = useMemo(() => {
    if (!latestResult) return "safe";
    for (const obj of latestResult.objects) {
      if (obj.label.toLowerCase() === "person" && obj.bbox.h > PERSON_DANGER_THRESHOLD) return "danger";
    }
    for (const obj of latestResult.objects) {
      if (obj.label.toLowerCase() === "person" && obj.bbox.h > PERSON_CAUTION_THRESHOLD) return "caution";
    }
    if (latestResult.objects.some((o) => o.label.toLowerCase().includes("knife") || o.confidence < LOW_CONFIDENCE_THRESHOLD))
      return "caution";
    return "safe";
  }, [latestResult]);

  const safetyColor =
    overallSafety === "danger"
      ? "text-red-400"
      : overallSafety === "caution"
        ? "text-terminal-amber"
        : "text-terminal-green";

  const stats = [
    {
      label: "FPS",
      value: String(metrics.fps),
      color:
        metrics.fps > 20
          ? "text-terminal-green"
          : metrics.fps > 10
            ? "text-terminal-amber"
            : "text-red-400",
    },
    {
      label: "Latency",
      value: `${metrics.latency_ms.toFixed(0)}ms`,
      color:
        metrics.latency_ms > 0 && metrics.latency_ms < 50
          ? "text-terminal-green"
          : metrics.latency_ms < 100
            ? "text-terminal-amber"
            : metrics.latency_ms > 0
              ? "text-red-400"
              : "text-foreground",
    },
    { label: "Objects", value: String(latestResult?.objects.length ?? 0) },
    { label: "Safety", value: overallSafety.toUpperCase(), color: safetyColor },
    { label: "Frames", value: String(metrics.frame_count) },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card/50 rounded-md border border-foreground/10 px-3 py-2 text-center"
        >
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </div>
          <div
            className={`font-mono text-sm tabular-nums font-semibold ${stat.color ?? "text-foreground"}`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

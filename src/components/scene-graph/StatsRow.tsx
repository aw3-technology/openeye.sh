import { Activity, Zap, Box, Link2, AlertTriangle, Layers } from "lucide-react";
import type { PerceptionFrame } from "@/types/openeye";

export function StatsRow({
  frame,
  metrics,
}: {
  frame: PerceptionFrame | null;
  metrics: { fps: number; latency_ms: number; frame_count: number };
}) {
  const nodeCount = frame?.scene_graph.nodes.length ?? 0;
  const relCount = frame?.scene_graph.relationships.length ?? 0;
  const hazardCount = frame?.safety_alerts.length ?? 0;
  const has3D = frame?.depth_available ?? false;

  const stats = [
    {
      label: "FPS",
      value: String(metrics.fps),
      icon: Activity,
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
      icon: Zap,
      color:
        metrics.latency_ms > 0 && metrics.latency_ms < 50
          ? "text-terminal-green"
          : metrics.latency_ms < 100
            ? "text-terminal-amber"
            : "text-red-400",
    },
    {
      label: "Nodes",
      value: String(nodeCount),
      icon: Box,
      color: "text-terminal-green",
    },
    {
      label: "Relations",
      value: String(relCount),
      icon: Link2,
      color: "text-blue-400",
    },
    {
      label: "Hazards",
      value: String(hazardCount),
      icon: AlertTriangle,
      color: hazardCount > 0 ? "text-terminal-amber" : "text-terminal-green",
    },
    {
      label: "Depth",
      value: has3D ? "3D" : "2D",
      icon: Layers,
      color: has3D ? "text-blue-400" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-md border px-3 py-2 text-center"
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <stat.icon className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className={`font-mono text-sm tabular-nums font-semibold ${stat.color}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

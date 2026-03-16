import type { Observation } from "@/types/agent";

export function SignificanceTimeline({
  observations,
  onTickClick,
  expandedId,
}: {
  observations: Observation[];
  onTickClick: (obs: Observation) => void;
  expandedId: string | null;
}) {
  const maxTick = Math.max(...observations.map((o) => o.tick));

  return (
    <div className="relative pb-5">
    <div className="flex items-end gap-px h-16">
      {observations.map((obs) => {
        const heightPct = Math.max(8, obs.significance * 100);
        const isActive = expandedId === obs.id;
        const barColor =
          obs.significance >= 0.7
            ? "bg-terminal-red"
            : obs.significance >= 0.4
              ? "bg-terminal-amber"
              : "bg-terminal-green";
        return (
          <button
            key={obs.id}
            onClick={() => onTickClick(obs)}
            className={`relative flex-1 rounded-t transition-all group ${
              isActive ? "ring-1 ring-terminal-green" : ""
            }`}
            style={{ height: `${heightPct}%` }}
            title={`Tick ${obs.tick}: ${obs.scene_summary} (${(obs.significance * 100).toFixed(0)}%)`}
          >
            <div
              className={`absolute inset-0 rounded-t ${barColor} ${
                isActive ? "opacity-100" : "opacity-60 group-hover:opacity-90"
              } transition-opacity`}
            />
            {/* Tick label on hover */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              T{obs.tick}
            </div>
          </button>
        );
      })}
    </div>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] font-mono text-muted-foreground pointer-events-none">
        <span>T1</span>
        <span>T{maxTick}</span>
      </div>
    </div>
  );
}

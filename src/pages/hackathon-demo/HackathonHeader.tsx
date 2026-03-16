import { Activity, Zap } from "lucide-react";
import { type Phase, type NebiusStats, PHASES, PHASE_ACTIVE_STYLES } from "./constants";

export function HackathonHeader({
  phase,
  fps,
  latency,
  isConnected,
  nebiusStats,
}: {
  phase: Phase;
  fps: number;
  latency: number;
  isConnected: boolean;
  nebiusStats: NebiusStats | null;
}) {
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-white/10 bg-black/95 shrink-0">
      {/* Logo + Phase */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(153,100%,50%)]" />
          <span className="text-white text-xs font-bold tracking-[0.2em]">
            OPENEYE
          </span>
          <span className="text-white/30 text-xs">▸</span>
          <span className="text-emerald-400 text-xs tracking-wider">
            PERCEPTION OS
          </span>
        </div>

        {/* Phase indicators */}
        <div className="flex items-center gap-1 ml-4">
          {PHASES.map((p) => (
            <div
              key={p}
              className={`px-2 py-0.5 text-[10px] tracking-wider rounded transition-all ${
                p === phase
                  ? PHASE_ACTIVE_STYLES[p]
                  : "text-white/20 border border-transparent"
              }`}
            >
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          <span className={isConnected ? "text-emerald-400" : "text-red-400"}>
            {isConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3 text-white/40" />
          <span
            className={
              fps > 15
                ? "text-emerald-400"
                : fps > 5
                  ? "text-amber-400"
                  : "text-red-400"
            }
          >
            {fps} FPS
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-white/40" />
          <span
            className={
              latency < 50
                ? "text-emerald-400"
                : latency < 100
                  ? "text-amber-400"
                  : "text-red-400"
            }
          >
            {latency.toFixed(0)}ms
          </span>
        </div>

        {nebiusStats?.configured && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 animate-hackathon-glow">
            <span className="text-blue-400">NEBIUS</span>
            <span className="text-white/50">
              {nebiusStats.total_calls} calls
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

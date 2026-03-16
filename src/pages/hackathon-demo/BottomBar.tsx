import { Target, Send } from "lucide-react";
import type { AgenticFrame, NebiusStats } from "./constants";

export function BottomBar({
  goalInput,
  setGoalInput,
  onSetGoal,
  events,
  nebiusStats,
  agenticFrame,
}: {
  goalInput: string;
  setGoalInput: (v: string) => void;
  onSetGoal: () => void;
  events: Array<{ time: number; text: string; type: string }>;
  nebiusStats: NebiusStats | null;
  agenticFrame: AgenticFrame | null;
}) {
  return (
    <div className="h-12 flex items-center gap-4 px-4 border-t border-white/10 bg-black/95 shrink-0">
      {/* Goal input */}
      <div className="flex items-center gap-2 flex-[2]">
        <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <input
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSetGoal()}
          placeholder="Set agent goal..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 font-mono"
        />
        <button
          onClick={onSetGoal}
          className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>

      {/* Event timeline */}
      <div className="flex-[3] overflow-hidden">
        <div className="flex items-center gap-3 text-[10px] overflow-x-auto scrollbar-hide">
          {events.slice(0, 5).map((evt, i) => (
            <span
              key={`${evt.time}-${i}`}
              className={`whitespace-nowrap ${
                evt.type === "danger"
                  ? "text-red-400"
                  : evt.type === "caution"
                    ? "text-yellow-400"
                    : evt.type === "goal"
                      ? "text-emerald-400"
                      : "text-white/30"
              }`}
            >
              {evt.text}
            </span>
          ))}
          {events.length === 0 && (
            <span className="text-white/15">Events will appear here...</span>
          )}
        </div>
      </div>

      {/* Nebius stats */}
      <div className="flex items-center gap-3 text-[10px] text-white/30 shrink-0">
        {nebiusStats?.configured ? (
          <>
            <span className="text-blue-400">NEBIUS</span>
            <span className="tabular-nums">
              {nebiusStats.total_calls} calls
            </span>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {(nebiusStats.total_tokens_estimated / 1000).toFixed(1)}k tok
            </span>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {nebiusStats.avg_latency_ms.toFixed(0)}ms avg
            </span>
          </>
        ) : (
          <span>Nebius: not configured</span>
        )}
        {agenticFrame && (
          <>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {agenticFrame.memory.frame_count}f
            </span>
          </>
        )}
      </div>
    </div>
  );
}

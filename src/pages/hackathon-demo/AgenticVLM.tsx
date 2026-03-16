import { Brain } from "lucide-react";
import type { AgenticFrame } from "./constants";

export function AgenticVLM({
  agenticFrame,
}: {
  agenticFrame: AgenticFrame | null;
}) {
  if (
    !agenticFrame?.vlm_reasoning?.description ||
    agenticFrame.vlm_reasoning.description.startsWith("VLM")
  ) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-cyan-400 uppercase tracking-wider">
        <Brain className="h-3.5 w-3.5" />
        <span>Agentic VLM</span>
        <span className="ml-auto text-white/30 tabular-nums">
          {agenticFrame.vlm_reasoning.latency_ms.toFixed(0)}ms
        </span>
      </div>
      <div className="bg-cyan-500/5 rounded-md border border-cyan-500/10 p-2">
        <p className="text-[11px] text-white/60 leading-relaxed line-clamp-3">
          {agenticFrame.vlm_reasoning.description}
        </p>
      </div>
    </div>
  );
}

import { Bot, Play, Square } from "lucide-react";
import { useAgentStream } from "@/hooks/useAgentStream";
import { ScenePanel } from "@/components/dashboard/agent/ScenePanel";
import { ReasoningLog } from "@/components/dashboard/agent/ReasoningLog";
import { PlanPanel } from "@/components/dashboard/agent/PlanPanel";

export default function AgentLoop() {
  const { ticks, currentTick, plan, isRunning, memories, startAgent, stopAgent } =
    useAgentStream();

  const detections = currentTick?.observation?.detections ?? [];
  const sceneSummary = currentTick?.observation?.scene_summary ?? "";
  const tickNumber = currentTick?.tick ?? 0;
  const planChanged = currentTick?.reasoning?.plan_changed ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-terminal-green" />
          <h1 className="text-xl font-semibold">Agent Loop</h1>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 bg-terminal-green/15 text-terminal-green border border-terminal-green/30 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
              RUNNING
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={stopAgent}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono bg-terminal-red/15 text-terminal-red border border-terminal-red/30 rounded hover:bg-terminal-red/25 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => startAgent("demo")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono bg-terminal-green/15 text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/25 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              Start Demo
            </button>
          )}
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Scene View */}
        <div className="border border-foreground/5 rounded-lg p-4 bg-card">
          <ScenePanel
            detections={detections}
            tickNumber={tickNumber}
            sceneSummary={sceneSummary}
          />
        </div>

        {/* Center: Reasoning Log */}
        <div className="border border-foreground/5 rounded-lg p-4 bg-card">
          <ReasoningLog ticks={ticks} />
        </div>

        {/* Right: Plan + Memory */}
        <div className="border border-foreground/5 rounded-lg p-4 bg-card">
          <PlanPanel
            plan={plan}
            memories={memories}
            planChanged={planChanged}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
        <span>Ticks: {ticks.length}</span>
        <span>Detections: {detections.length}</span>
        <span>Memories: {memories.length}</span>
        <span>
          Phase:{" "}
          <span
            className={
              currentTick?.phase === "perceive"
                ? "text-terminal-green"
                : currentTick?.phase === "recall"
                  ? "text-blue-400"
                  : currentTick?.phase === "reason"
                    ? "text-yellow-400"
                    : currentTick?.phase === "act"
                      ? "text-orange-400"
                      : ""
            }
          >
            {currentTick?.phase ?? "idle"}
          </span>
        </span>
      </div>
    </div>
  );
}

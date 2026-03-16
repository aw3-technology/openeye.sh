import type { AgenticFrame } from "./constants";
import { SceneUnderstanding } from "./SceneUnderstanding";
import { AgenticReasoning } from "./AgenticReasoning";
import { AgenticVLM } from "./AgenticVLM";
import { SafetyGuardian } from "./SafetyGuardian";
import { DetectionsList } from "./DetectionsList";

export function IntelligencePanel({
  vlmText,
  vlmTyping,
  vlmLatency,
  vlmPending,
  agenticFrame,
  goal,
  safetyLevel,
}: {
  vlmText: string;
  vlmTyping: boolean;
  vlmLatency: number;
  vlmPending: boolean;
  agenticFrame: AgenticFrame | null;
  goal: string;
  safetyLevel: string;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-3 gap-3">
      <SceneUnderstanding
        vlmText={vlmText}
        vlmTyping={vlmTyping}
        vlmLatency={vlmLatency}
        vlmPending={vlmPending}
      />
      <AgenticReasoning agenticFrame={agenticFrame} goal={goal} />
      <AgenticVLM agenticFrame={agenticFrame} />
      <SafetyGuardian agenticFrame={agenticFrame} safetyLevel={safetyLevel} />
      <DetectionsList agenticFrame={agenticFrame} />
    </div>
  );
}

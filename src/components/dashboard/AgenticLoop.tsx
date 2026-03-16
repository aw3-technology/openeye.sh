import { useAgenticLoop } from "./agentic/useAgenticLoop";
import { ControlBar } from "./agentic/ControlBar";
import { StatusHud } from "./agentic/StatusHud";
import { ActionPlanPanel } from "./agentic/ActionPlanPanel";
import { VLMReasoningPanel, VLMHistoryPanel } from "./agentic/VLMReasoningPanel";
import { DetectionsPanel } from "./agentic/DetectionsPanel";
import { SafetyAlertsPanel, SafetyZonesPanel } from "./agentic/SafetyPanels";
import { ScenePanel } from "./agentic/ScenePanel";
import { ObjectMemoryPanel, ObservationTimeline } from "./agentic/MemoryPanel";

// Re-export types for consumers
export type { AgenticDetection } from "./agentic/types";
export type { AgenticLoopProps } from "./agentic/types";

interface AgenticLoopProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  onDetections?: (detections: import("./agentic/types").AgenticDetection[]) => void;
  onRunningChange?: (running: boolean) => void;
}

export function AgenticLoop({ videoRef, isStreaming, onDetections, onRunningChange }: AgenticLoopProps) {
  const state = useAgenticLoop({ videoRef, isStreaming, onDetections, onRunningChange });

  return (
    <div className="space-y-4">
      <ControlBar
        connected={state.connected}
        running={state.running}
        goal={state.goal}
        goalInput={state.goalInput}
        setGoalInput={state.setGoalInput}
        handleSetGoal={state.handleSetGoal}
        setPresetGoal={state.setPresetGoal}
        startAgent={state.startAgent}
        stopLoop={state.stopLoop}
        isStreaming={state.isStreaming}
      />

      <StatusHud
        running={state.running}
        fps={state.fps}
        latestFrame={state.latestFrame}
        detectionCount={state.detectionCount}
        totalFrames={state.totalFrames}
        hasSafetyAlerts={state.hasSafetyAlerts}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <ActionPlanPanel latestFrame={state.latestFrame} running={state.running} />
          <VLMReasoningPanel latestFrame={state.latestFrame} running={state.running} />
          <DetectionsPanel latestFrame={state.latestFrame} running={state.running} detectionCount={state.detectionCount} />
          <SafetyAlertsPanel latestFrame={state.latestFrame} hasSafetyAlerts={state.hasSafetyAlerts} />
          <SafetyZonesPanel latestFrame={state.latestFrame} hasSafetyZones={state.hasSafetyZones} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <ScenePanel latestFrame={state.latestFrame} hasChangeAlerts={state.hasChangeAlerts} />
          <ObjectMemoryPanel latestFrame={state.latestFrame} running={state.running} />
          <ObservationTimeline latestFrame={state.latestFrame} running={state.running} />
          <VLMHistoryPanel vlmHistory={state.vlmHistory} />
        </div>
      </div>
    </div>
  );
}

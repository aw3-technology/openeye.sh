import { useSafetyDemoState } from "@/hooks/useSafetyDemoState";
import { CameraFeed } from "./safety-demo/CameraFeed";
import { SafetyPanel } from "./safety-demo/SafetyPanel";

export function SafetyDemo() {
  const { currentState, logs, handVisible, handPosition, robotPaused, cycleId } =
    useSafetyDemoState();

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <CameraFeed
        currentState={currentState}
        handVisible={handVisible}
        handPosition={handPosition}
        robotPaused={robotPaused}
      />
      <SafetyPanel
        currentState={currentState}
        logs={logs}
        cycleId={cycleId}
      />
    </div>
  );
}

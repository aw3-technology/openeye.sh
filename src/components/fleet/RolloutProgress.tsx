import type { RolloutStage, DeploymentStatus } from "@/types/fleet";

interface RolloutProgressProps {
  stages: RolloutStage[];
  currentStage: number;
  status: DeploymentStatus;
}

const stageStatusColor: Record<string, string> = {
  completed: "bg-green-500",
  active: "bg-teal-500 animate-pulse",
  pending: "bg-muted",
};

export function RolloutProgress({ stages, currentStage, status }: RolloutProgressProps) {
  if (stages.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">No rollout stages defined</p>
      </div>
    );
  }

  const isFailed = status === "failed" || status === "rolled_back" || status === "rolling_back";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => {
          let state = "pending";
          if (i < currentStage) state = "completed";
          else if (i === currentStage && status === "in_progress") state = "active";
          if (isFailed && i === currentStage) state = "failed";

          return (
            <div key={stage.name} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  state === "completed"
                    ? "bg-green-500"
                    : state === "active"
                    ? "bg-teal-500 animate-pulse"
                    : state === "failed"
                    ? "bg-red-500"
                    : "bg-muted"
                }`}
              />
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{stage.name}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Stage {currentStage + 1} of {stages.length} &middot; {stages[currentStage]?.percentage ?? 0}% rollout
      </p>
    </div>
  );
}

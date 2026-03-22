import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import type { DeploymentResponse } from "@/types/fleet";

export function StageTimeline({ deployment }: { deployment: DeploymentResponse }) {
  if (deployment.rollout_stages.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Stage Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {deployment.rollout_stages.map((stage, i) => {
            const isCompleted = i < deployment.current_stage;
            const isCurrent = i === deployment.current_stage;
            const isFailed = isCurrent && (deployment.status === "failed" || deployment.status === "rolling_back");

            return (
              <div key={stage.name} className="flex items-start gap-3">
                {/* Timeline dot & line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCompleted
                        ? "bg-green-500/20 text-green-400"
                        : isFailed
                        ? "bg-red-500/20 text-red-400"
                        : isCurrent
                        ? "bg-teal-500/20 text-teal-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isFailed ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : isCurrent && deployment.status === "in_progress" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < deployment.rollout_stages.length - 1 && (
                    <div className={`w-px h-8 ${isCompleted ? "bg-green-500/30" : "bg-border"}`} />
                  )}
                </div>
                {/* Stage info */}
                <div className="flex-1 pb-2">
                  <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {stage.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stage.percentage}% of devices &middot; {Math.floor(stage.min_wait_seconds / 60)}m min wait
                  </p>
                </div>
                {/* Stage status */}
                <div>
                  {isCompleted && (
                    <span className="text-xs text-green-400">Completed</span>
                  )}
                  {isCurrent && deployment.status === "in_progress" && (
                    <span className="text-xs text-teal-400 animate-pulse">Active</span>
                  )}
                  {isCurrent && deployment.status === "paused" && (
                    <span className="text-xs text-blue-400">Paused</span>
                  )}
                  {isFailed && (
                    <span className="text-xs text-red-400">Failed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

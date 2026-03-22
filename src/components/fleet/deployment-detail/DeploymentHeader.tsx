import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FastForward,
  Undo2,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import type { DeploymentResponse } from "@/types/fleet";
import { deploymentStatusBadge as statusBadge, strategyIcon, strategyLabel } from "@/lib/fleet-constants";
import { Layers } from "lucide-react";

interface DeploymentHeaderProps {
  deployment: DeploymentResponse;
  advanceMutation: { mutate: (id: string, opts: { onSuccess: () => void }) => void; isPending: boolean };
  pauseMutation: { mutate: (id: string, opts: { onSuccess: () => void }) => void; isPending: boolean };
  rollbackMutation: { mutate: (id: string, opts: { onSuccess: () => void }) => void; isPending: boolean };
}

export function DeploymentHeader({ deployment, advanceMutation, pauseMutation, rollbackMutation }: DeploymentHeaderProps) {
  const navigate = useNavigate();

  const canAdvance = deployment.status === "pending" || deployment.status === "in_progress";
  const canPause = deployment.status === "in_progress";
  const canResume = deployment.status === "paused";
  const canRollback = deployment.status === "in_progress" || deployment.status === "paused";

  const StratIcon = strategyIcon[deployment.strategy] || Layers;

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fleet/deployments")}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{deployment.name}</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge[deployment.status] || ""}`}
          >
            {deployment.status === "in_progress" && (
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            )}
            {deployment.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
          <span>{deployment.model_id} v{deployment.model_version}</span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span className="inline-flex items-center gap-1">
            <StratIcon className="h-3 w-3" />
            {strategyLabel[deployment.strategy] || deployment.strategy}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {canPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => pauseMutation.mutate(deployment.id, {
              onSuccess: () => toast.success("Deployment paused"),
            })}
            disabled={pauseMutation.isPending}
          >
            <Pause className="h-4 w-4 mr-1" /> Pause
          </Button>
        )}
        {canResume && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => advanceMutation.mutate(deployment.id, {
              onSuccess: () => toast.success("Deployment resumed"),
            })}
            disabled={advanceMutation.isPending}
          >
            <Play className="h-4 w-4 mr-1" /> Resume
          </Button>
        )}
        {canAdvance && deployment.status !== "paused" && (
          <Button
            size="sm"
            onClick={() => advanceMutation.mutate(deployment.id, {
              onSuccess: () => toast.success("Advanced to next stage"),
            })}
            disabled={advanceMutation.isPending}
          >
            <FastForward className="h-4 w-4 mr-1" /> Advance Stage
          </Button>
        )}
        {canRollback && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (!window.confirm("Rollback this deployment to the previous version?")) return;
              rollbackMutation.mutate(deployment.id, {
                onSuccess: () => toast.success("Rollback initiated"),
              });
            }}
            disabled={rollbackMutation.isPending}
          >
            <Undo2 className="h-4 w-4 mr-1" /> Rollback
          </Button>
        )}
      </div>
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RolloutProgress } from "@/components/fleet/RolloutProgress";
import { DeviceStatusBadge } from "@/components/fleet/DeviceStatusBadge";
import {
  useFleetDeployment,
  useDeploymentDevices,
  useAdvanceDeployment,
  useRollbackDeployment,
} from "@/hooks/useFleetQueries";
import { ArrowLeft, FastForward, Undo2, Pause } from "lucide-react";
import { toast } from "sonner";

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deployment, isLoading } = useFleetDeployment(id || "");
  const { data: deviceStatuses } = useDeploymentDevices(id || "");
  const advanceMutation = useAdvanceDeployment();
  const rollbackMutation = useRollbackDeployment();

  if (isLoading) return <p className="text-muted-foreground p-8">Loading...</p>;
  if (!deployment) return <p className="text-muted-foreground p-8">Deployment not found</p>;

  const canAdvance = deployment.status === "pending" || deployment.status === "in_progress";
  const canRollback = deployment.status === "in_progress" || deployment.status === "paused";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fleet/deployments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{deployment.name}</h1>
          <p className="text-sm text-muted-foreground">
            {deployment.model_id} v{deployment.model_version} &middot; {deployment.strategy}
          </p>
        </div>
        {canAdvance && (
          <Button size="sm" onClick={() => advanceMutation.mutate(deployment.id, {
            onSuccess: () => toast.success("Advanced to next stage"),
          })} disabled={advanceMutation.isPending}>
            <FastForward className="h-4 w-4 mr-1" /> Advance Stage
          </Button>
        )}
        {canRollback && (
          <Button size="sm" variant="destructive" onClick={() => {
            if (!window.confirm("Rollback this deployment to the previous version?")) return;
            rollbackMutation.mutate(deployment.id, {
              onSuccess: () => toast.success("Rollback initiated"),
            });
          }} disabled={rollbackMutation.isPending}>
            <Undo2 className="h-4 w-4 mr-1" /> Rollback
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Rollout Progress</CardTitle></CardHeader>
        <CardContent>
          <RolloutProgress stages={deployment.rollout_stages} currentStage={deployment.current_stage} status={deployment.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Per-Device Status</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!deviceStatuses || deviceStatuses.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No devices targeted</TableCell></TableRow>
              )}
              {(deviceStatuses || []).map((ds) => (
                <TableRow key={ds.id}>
                  <TableCell className="text-xs font-mono">{ds.device_id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${ds.status === "completed" ? "text-green-400" : ds.status === "failed" ? "text-red-400" : "text-muted-foreground"}`}>
                      {ds.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{ds.stage}</TableCell>
                  <TableCell className="text-xs tabular-nums">{ds.progress}%</TableCell>
                  <TableCell className="text-xs text-red-400">{ds.error_message || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

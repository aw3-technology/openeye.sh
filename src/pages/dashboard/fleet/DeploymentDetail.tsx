import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolloutProgress } from "@/components/fleet/RolloutProgress";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import {
  useFleetDeployment,
  useDeploymentDevices,
  useAdvanceDeployment,
  usePauseDeployment,
  useRollbackDeployment,
} from "@/hooks/useFleetQueries";
import { DeploymentHeader } from "@/components/fleet/deployment-detail/DeploymentHeader";
import { DeploymentDevicesTab } from "@/components/fleet/deployment-detail/DeploymentDevicesTab";
import { DeploymentDetailsTab } from "@/components/fleet/deployment-detail/DeploymentDetailsTab";
import { StageTimeline } from "@/components/fleet/deployment-detail/StageTimeline";
import { formatElapsed as formatDuration } from "@/lib/format-utils";

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: deployment, isLoading } = useFleetDeployment(id || "");
  const { data: deviceStatuses } = useDeploymentDevices(id || "");
  const advanceMutation = useAdvanceDeployment();
  const pauseMutation = usePauseDeployment();
  const rollbackMutation = useRollbackDeployment();

  if (isLoading) return <LoadingState message="Loading deployment..." className="p-8" />;
  if (!deployment) return <EmptyState message="Deployment not found" className="p-8" />;

  // Device status summary
  const deviceCounts = {
    total: deviceStatuses?.length ?? 0,
    completed: deviceStatuses?.filter((d) => d.status === "completed").length ?? 0,
    failed: deviceStatuses?.filter((d) => d.status === "failed").length ?? 0,
    inProgress: deviceStatuses?.filter((d) => d.status === "in_progress").length ?? 0,
    pending: deviceStatuses?.filter((d) => d.status === "pending").length ?? 0,
  };

  const overallProgress = deviceCounts.total > 0
    ? Math.round((deviceCounts.completed / deviceCounts.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DeploymentHeader
        deployment={deployment}
        advanceMutation={advanceMutation}
        pauseMutation={pauseMutation}
        rollbackMutation={rollbackMutation}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Target Devices</p>
            <p className="text-xl font-semibold tabular-nums">{deviceCounts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overall Progress</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold tabular-nums">{overallProgress}%</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-xl font-semibold tabular-nums">
              {deployment.started_at
                ? formatDuration(deployment.started_at, deployment.completed_at)
                : "Not started"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Failures</p>
            <p className={`text-xl font-semibold tabular-nums ${deviceCounts.failed > 0 ? "text-red-400" : ""}`}>
              {deviceCounts.failed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="rollout">
        <TabsList>
          <TabsTrigger value="rollout">Rollout</TabsTrigger>
          <TabsTrigger value="devices">Devices ({deviceCounts.total})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Rollout tab */}
        <TabsContent value="rollout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rollout Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <RolloutProgress
                stages={deployment.rollout_stages}
                currentStage={deployment.current_stage}
                status={deployment.status}
              />
            </CardContent>
          </Card>

          <StageTimeline deployment={deployment} />
        </TabsContent>

        {/* Devices tab */}
        <TabsContent value="devices" className="space-y-4">
          <DeploymentDevicesTab
            deviceStatuses={deviceStatuses}
            deviceCounts={deviceCounts}
          />
        </TabsContent>

        {/* Details tab */}
        <TabsContent value="details" className="space-y-4">
          <DeploymentDetailsTab deployment={deployment} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

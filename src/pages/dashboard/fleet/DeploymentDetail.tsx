import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  ArrowLeft,
  FastForward,
  Undo2,
  Pause,
  Play,
  Monitor,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { DeploymentStatus } from "@/types/fleet";
import { deploymentStatusBadge as statusBadge, strategyIcon, strategyLabel } from "@/lib/fleet-constants";
import { formatElapsed as formatDuration } from "@/lib/format-utils";

const deviceStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  completed: { icon: CheckCircle2, color: "text-green-400" },
  failed: { icon: XCircle, color: "text-red-400" },
  in_progress: { icon: Loader2, color: "text-teal-400" },
  pending: { icon: Clock, color: "text-yellow-400" },
  rolling_back: { icon: Undo2, color: "text-orange-400" },
};

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deployment, isLoading } = useFleetDeployment(id || "");
  const { data: deviceStatuses } = useDeploymentDevices(id || "");
  const advanceMutation = useAdvanceDeployment();
  const pauseMutation = usePauseDeployment();
  const rollbackMutation = useRollbackDeployment();

  if (isLoading) return <LoadingState message="Loading deployment..." className="p-8" />;
  if (!deployment) return <EmptyState message="Deployment not found" className="p-8" />;

  const canAdvance = deployment.status === "pending" || deployment.status === "in_progress";
  const canPause = deployment.status === "in_progress";
  const canResume = deployment.status === "paused";
  const canRollback = deployment.status === "in_progress" || deployment.status === "paused";

  const StratIcon = strategyIcon[deployment.strategy] || Layers;

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

          {/* Stage timeline */}
          {deployment.rollout_stages.length > 0 && (
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
          )}
        </TabsContent>

        {/* Devices tab */}
        <TabsContent value="devices" className="space-y-4">
          {/* Device status summary bar */}
          {deviceCounts.total > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {deviceCounts.completed} completed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                {deviceCounts.inProgress} in progress
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                {deviceCounts.pending} pending
              </span>
              {deviceCounts.failed > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {deviceCounts.failed} failed
                </span>
              )}
            </div>
          )}

          <Card>
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
                  {(!deviceStatuses || deviceStatuses.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-8 text-center space-y-2">
                          <Monitor className="h-8 w-8 mx-auto text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">No devices targeted yet</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    deviceStatuses.map((ds) => {
                      const cfg = deviceStatusConfig[ds.status] || deviceStatusConfig.pending;
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={ds.id}>
                          <TableCell className="text-xs font-mono">{ds.device_id.slice(0, 12)}...</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                              <StatusIcon className={`h-3 w-3 ${ds.status === "in_progress" ? "animate-spin" : ""}`} />
                              {ds.status.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            Stage {ds.stage + 1}
                          </TableCell>
                          <TableCell className="w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    ds.status === "completed"
                                      ? "bg-green-500"
                                      : ds.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-teal-500"
                                  }`}
                                  style={{ width: `${ds.progress}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                                {ds.progress}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {ds.error_message ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                                <AlertTriangle className="h-3 w-3" />
                                {ds.error_message}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deployment Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Deployment ID</dt>
                  <dd className="font-mono text-xs mt-0.5">{deployment.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Model ID</dt>
                  <dd className="mt-0.5">{deployment.model_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Model Version</dt>
                  <dd className="mt-0.5">v{deployment.model_version}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Strategy</dt>
                  <dd className="mt-0.5 flex items-center gap-1">
                    <StratIcon className="h-3 w-3 text-muted-foreground" />
                    {strategyLabel[deployment.strategy]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rollout Stages</dt>
                  <dd className="mt-0.5 tabular-nums">{deployment.rollout_stages.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Target Devices</dt>
                  <dd className="mt-0.5 tabular-nums">{deployment.target_device_ids.length}</dd>
                </div>
                {deployment.model_url && (
                  <div className="col-span-2 md:col-span-3">
                    <dt className="text-xs text-muted-foreground">Model URL</dt>
                    <dd className="font-mono text-xs mt-0.5 break-all">{deployment.model_url}</dd>
                  </div>
                )}
                {deployment.model_checksum && (
                  <div className="col-span-2 md:col-span-3">
                    <dt className="text-xs text-muted-foreground">Checksum</dt>
                    <dd className="font-mono text-xs mt-0.5">{deployment.model_checksum}</dd>
                  </div>
                )}
                {deployment.bandwidth_limit_mbps && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Bandwidth Limit</dt>
                    <dd className="mt-0.5 tabular-nums">{deployment.bandwidth_limit_mbps} Mbps</dd>
                  </div>
                )}
                {deployment.rollback_version && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Rollback Version</dt>
                    <dd className="mt-0.5">v{deployment.rollback_version}</dd>
                  </div>
                )}
                {deployment.target_group_id && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Target Group</dt>
                    <dd className="font-mono text-xs mt-0.5">{deployment.target_group_id}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-0.5 tabular-nums text-xs">{new Date(deployment.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Started</dt>
                  <dd className="mt-0.5 tabular-nums text-xs">
                    {deployment.started_at ? new Date(deployment.started_at).toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Completed</dt>
                  <dd className="mt-0.5 tabular-nums text-xs">
                    {deployment.completed_at ? new Date(deployment.completed_at).toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last Updated</dt>
                  <dd className="mt-0.5 tabular-nums text-xs">{new Date(deployment.updated_at).toLocaleString()}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

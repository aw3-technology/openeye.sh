import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import type { DeploymentResponse } from "@/types/fleet";
import { strategyIcon, strategyLabel } from "@/lib/fleet-constants";

export function DeploymentDetailsTab({ deployment }: { deployment: DeploymentResponse }) {
  const StratIcon = strategyIcon[deployment.strategy] || Layers;

  return (
    <div className="space-y-4">
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
    </div>
  );
}

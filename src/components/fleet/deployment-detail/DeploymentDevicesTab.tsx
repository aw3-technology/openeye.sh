import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Monitor,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import type { DeploymentDeviceStatusResponse } from "@/types/fleet";

const deviceStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  completed: { icon: CheckCircle2, color: "text-green-400" },
  failed: { icon: XCircle, color: "text-red-400" },
  in_progress: { icon: Loader2, color: "text-teal-400" },
  pending: { icon: Clock, color: "text-yellow-400" },
  rolling_back: { icon: Undo2, color: "text-orange-400" },
};

interface DeviceCounts {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
}

interface DeploymentDevicesTabProps {
  deviceStatuses: DeploymentDeviceStatusResponse[] | undefined;
  deviceCounts: DeviceCounts;
}

export function DeploymentDevicesTab({ deviceStatuses, deviceCounts }: DeploymentDevicesTabProps) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

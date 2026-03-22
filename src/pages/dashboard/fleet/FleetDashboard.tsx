import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeviceTable } from "@/components/fleet/DeviceTable";
import { RegisterDeviceDialog } from "@/components/fleet/RegisterDeviceDialog";
import { DeviceStatusBadge } from "@/components/fleet/DeviceStatusBadge";
import { RolloutProgress } from "@/components/fleet/RolloutProgress";
import { useFleetDevices, useFleetDeployments, useFleetAlerts, useFleetGroups, useFleetSummary } from "@/hooks/useFleetQueries";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LoadingState } from "@/components/ui/data-states";
import {
  Monitor, Wifi, WifiOff, AlertTriangle, Rocket, Bell,
  Camera, Bot, Cpu, Radio, Plane,
  ArrowRight, CheckCircle, Layers, Wrench,
} from "lucide-react";
import type { DeviceType } from "@/types/fleet";
import { deploymentStatusBadge, severityBadge } from "@/lib/fleet-constants";

const deviceTypeIcon: Record<DeviceType, typeof Camera> = {
  camera: Camera,
  robot: Bot,
  edge_node: Cpu,
  gateway: Radio,
  drone: Plane,
};

const deviceTypeLabel: Record<DeviceType, string> = {
  camera: "Cameras",
  robot: "Robots",
  edge_node: "Edge Nodes",
  gateway: "Gateways",
  drone: "Drones",
};

export default function FleetDashboard() {
  const { data: devices, isLoading } = useFleetDevices();
  const { data: deployments } = useFleetDeployments();
  const { data: alerts } = useFleetAlerts(false);
  const { data: groups } = useFleetGroups();
  const summary = useFleetSummary();

  // Device type distribution
  const typeCounts = (devices || []).reduce<Record<string, number>>((acc, d) => {
    acc[d.device_type] = (acc[d.device_type] || 0) + 1;
    return acc;
  }, {});

  const activeDeployments = (deployments || []).filter(
    (d) => d.status === "in_progress" || d.status === "pending" || d.status === "paused"
  );

  const recentAlerts = (alerts || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fleet Overview</h1>
        <RegisterDeviceDialog />
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard icon={Monitor} label="Total Devices" value={summary.total_devices} color="bg-muted" />
          <MetricCard icon={Wifi} label="Online" value={summary.online_devices} color="bg-green-500/15 text-green-500" />
          <MetricCard icon={WifiOff} label="Offline" value={summary.offline_devices} color="bg-gray-500/15 text-gray-400" />
          <MetricCard icon={AlertTriangle} label="Errors" value={summary.error_devices} color="bg-red-500/15 text-red-500" />
          <MetricCard icon={Rocket} label="Active Deploys" value={summary.active_deployments} color="bg-teal-500/15 text-teal-500" />
          <MetricCard icon={Bell} label="Alerts" value={summary.unresolved_alerts} color="bg-amber-500/15 text-amber-500" />
        </div>
      )}

      {/* Device Type Distribution + Quick Nav */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Type Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Device Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(typeCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No devices registered</p>
            ) : (
              <div className="space-y-3">
                {(Object.entries(typeCounts) as [DeviceType, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const Icon = deviceTypeIcon[type] || Cpu;
                    const pct = devices ? Math.round((count / devices.length) * 100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="rounded-md bg-muted p-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{deviceTypeLabel[type] || type}</span>
                            <span className="text-muted-foreground tabular-nums">{count}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Fleet Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/dashboard/fleet/deployments">
                <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Rocket className="h-4 w-4 text-teal-500" />
                    <span className="text-sm font-medium">Deployments</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {deployments?.length ?? 0} total &middot; {activeDeployments.length} active
                  </p>
                </div>
              </Link>
              <Link to="/dashboard/fleet/groups">
                <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Device Groups</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {groups?.length ?? 0} groups configured
                  </p>
                </div>
              </Link>
              <Link to="/dashboard/fleet/maintenance">
                <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Maintenance</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Schedule windows</p>
                </div>
              </Link>
              <Link to="/dashboard/fleet/alerts">
                <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Alerts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {alerts?.length ?? 0} unresolved
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Deployments */}
      {activeDeployments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/fleet/deployments" className="text-xs">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeDeployments.slice(0, 3).map((dep) => (
                <div key={dep.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/fleet/deployments/${dep.id}`}
                        className="text-sm font-medium hover:underline text-primary truncate"
                      >
                        {dep.name}
                      </Link>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${deploymentStatusBadge[dep.status] || ""}`}>
                        {dep.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dep.model_id} v{dep.model_version} &middot; {dep.strategy} &middot; {dep.target_device_ids.length} devices
                    </div>
                    {dep.rollout_stages.length > 0 && (
                      <RolloutProgress stages={dep.rollout_stages} currentStage={dep.current_stage} status={dep.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/fleet/alerts" className="text-xs">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${severityBadge[alert.severity]}`}>
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {new Date(alert.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState message="Loading devices..." className="py-8 text-center" />
          ) : !devices || devices.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No devices registered yet.</p>
              <p className="text-xs text-muted-foreground">Click "Register Device" above to add your first edge device.</p>
            </div>
          ) : (
            <DeviceTable devices={devices} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

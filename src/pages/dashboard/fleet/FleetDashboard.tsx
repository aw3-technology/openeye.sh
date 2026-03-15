import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceTable } from "@/components/fleet/DeviceTable";
import { RegisterDeviceDialog } from "@/components/fleet/RegisterDeviceDialog";
import { useFleetDevices, useFleetSummary } from "@/hooks/useFleetQueries";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LoadingState } from "@/components/ui/data-states";
import { Monitor, Wifi, WifiOff, AlertTriangle, Rocket, Bell } from "lucide-react";

export default function FleetDashboard() {
  const { data: devices, isLoading } = useFleetDevices();
  const summary = useFleetSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fleet Overview</h1>
        <RegisterDeviceDialog />
      </div>

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

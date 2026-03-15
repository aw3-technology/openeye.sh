import { useEffect, useState } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useDevices } from "@/hooks/useOpenEyeQueries";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ServerUrlDialog } from "@/components/dashboard/ServerUrlDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Brain,
  Cpu,
  Gauge,
  Hash,
  MonitorSmartphone,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import type { NebiusStats } from "@/lib/openeye-client";

export default function Overview() {
  const { isConnected, healthData, serverUrl, client } = useOpenEyeConnection();
  const { data: devices = [] } = useDevices();
  const [nebiusStats, setNebiusStats] = useState<NebiusStats | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setNebiusStats(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const stats = await client.nebiusStats();
        if (!cancelled) setNebiusStats(stats);
      } catch {
        if (!cancelled) setNebiusStats(null);
      }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isConnected, client]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <ServerUrlDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Server Status"
          value={isConnected ? "Connected" : "Offline"}
          icon={isConnected ? Wifi : WifiOff}
          description={serverUrl}
        />
        <MetricCard
          label="Active Model"
          value={healthData?.model || (isConnected ? "—" : "Offline")}
          icon={Cpu}
        />
        <MetricCard
          label="Status"
          value={healthData?.status || (isConnected ? "—" : "Offline")}
          icon={Activity}
        />
        <MetricCard
          label="Devices"
          value={devices.length}
          icon={MonitorSmartphone}
        />
      </div>

      {/* Nebius Token Factory VLM Stats */}
      {nebiusStats && nebiusStats.configured && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-purple-500" aria-hidden="true" />
              Nebius Token Factory
              <span className="ml-auto text-xs font-normal text-muted-foreground font-mono">
                {nebiusStats.model}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-purple-500/10 p-2">
                  <Hash className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">VLM Calls</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {nebiusStats.total_calls}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-500/10 p-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tokens Used</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {nebiusStats.total_tokens_estimated.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-green-500/10 p-2">
                  <Gauge className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Latency</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {nebiusStats.avg_latency_ms > 0
                      ? `${(nebiusStats.avg_latency_ms / 1000).toFixed(1)}s`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`rounded-md p-2 ${nebiusStats.errors > 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
                  <Activity className={`h-4 w-4 ${nebiusStats.errors > 0 ? "text-red-500" : "text-green-500"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {nebiusStats.total_calls > 0
                      ? `${(((nebiusStats.total_calls - nebiusStats.errors) / nebiusStats.total_calls) * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices registered yet. Devices will appear here when they connect to your OpenEye server.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">{device.device_type}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{device.server_url}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

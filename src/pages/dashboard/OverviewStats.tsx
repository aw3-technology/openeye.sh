import { MetricCard } from "@/components/dashboard/MetricCard";
import { getTotalBalance } from "@/types/credits";
import {
  Clock,
  Coins,
  Cpu,
  MonitorSmartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { HealthResponse } from "@/types/openeye";
import type { CreditBalance } from "@/types/credits";

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface OverviewStatsProps {
  isConnected: boolean;
  serverUrl: string;
  healthData: HealthResponse | null;
  uptimeSeconds: number | undefined;
  deviceCount: number;
  isCloudDeployment: boolean;
  creditData: CreditBalance | undefined;
}

export function OverviewStats({
  isConnected,
  serverUrl,
  healthData,
  uptimeSeconds,
  deviceCount,
  isCloudDeployment,
  creditData,
}: OverviewStatsProps) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${isCloudDeployment ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      <MetricCard
        label="Server"
        value={isConnected ? "Connected" : "Offline"}
        icon={isConnected ? Wifi : WifiOff}
        color={isConnected ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}
        description={serverUrl || "Not configured"}
      />
      <MetricCard
        label="Active Model"
        value={healthData?.model || (isConnected ? "—" : "N/A")}
        icon={Cpu}
        color="bg-blue-500/15 text-blue-500"
      />
      <MetricCard
        label="Uptime"
        value={uptimeSeconds ? formatUptime(uptimeSeconds) : isConnected ? "—" : "N/A"}
        icon={Clock}
        color="bg-teal-500/15 text-teal-500"
      />
      <MetricCard
        label="Devices"
        value={deviceCount}
        icon={MonitorSmartphone}
        color="bg-purple-500/15 text-purple-500"
      />
      {isCloudDeployment && (
        <MetricCard
          label="Credits"
          value={creditData ? getTotalBalance(creditData) : "—"}
          icon={Coins}
          color="bg-yellow-500/15 text-yellow-500"
        />
      )}
    </div>
  );
}

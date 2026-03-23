import { useEffect, useState } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useDevices, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useCreditBalance } from "@/hooks/useCredits";
import { ServerUrlDialog } from "@/components/dashboard/ServerUrlDialog";
import { OverviewStats } from "./OverviewStats";
import { OverviewQuickActions } from "./OverviewQuickActions";
import { OverviewNebiusStats } from "./OverviewNebiusStats";
import { OverviewActivity } from "./OverviewActivity";
import { OverviewDevices } from "./OverviewDevices";
import type { NebiusStats } from "@/lib/openeye-client";

export default function Overview() {
  const { isConnected, healthData, serverUrl, client, isCloudDeployment } = useOpenEyeConnection();
  const { data: devices = [] } = useDevices();
  const { data: creditData } = useCreditBalance();
  const { data: historyData } = useInferenceHistory(0, 5);
  const [nebiusStats, setNebiusStats] = useState<NebiusStats | null>(null);

  const recentInferences = historyData?.data ?? [];

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
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            System overview and quick actions
          </p>
        </div>
        <ServerUrlDialog />
      </div>

      <OverviewStats
        isConnected={isConnected}
        serverUrl={serverUrl}
        healthData={healthData}
        uptimeSeconds={nebiusStats?.uptime_seconds}
        deviceCount={devices.length}
        isCloudDeployment={isCloudDeployment}
        creditData={creditData}
      />

      <OverviewQuickActions />

      {nebiusStats && nebiusStats.configured && (
        <OverviewNebiusStats nebiusStats={nebiusStats} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <OverviewActivity recentInferences={recentInferences} />
        <OverviewDevices devices={devices} />
      </div>
    </div>
  );
}

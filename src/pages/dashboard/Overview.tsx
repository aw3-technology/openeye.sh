import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useDevices, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useCreditBalance } from "@/hooks/useCredits";
import { getTotalBalance } from "@/types/credits";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ServerUrlDialog } from "@/components/dashboard/ServerUrlDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  Clock,
  Coins,
  Cpu,
  Gauge,
  Hash,
  ImagePlus,
  MonitorSmartphone,
  Radio,
  Video,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import type { NebiusStats } from "@/lib/openeye-client";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const quickActions = [
  { label: "Inference", icon: ImagePlus, path: "/dashboard/inference", description: "Run model predictions" },
  { label: "Live Stream", icon: Video, path: "/dashboard/live", description: "Camera feed + detection" },
  { label: "Agent Loop", icon: Bot, path: "/dashboard/agent", description: "Perception + reasoning" },
  { label: "Fleet", icon: Radio, path: "/dashboard/fleet", description: "Manage edge devices" },
] as const;

export default function Overview() {
  const { isConnected, healthData, serverUrl, client } = useOpenEyeConnection();
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

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Server"
          value={isConnected ? "Connected" : "Offline"}
          icon={isConnected ? Wifi : WifiOff}
          color={isConnected ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}
          description={serverUrl}
        />
        <MetricCard
          label="Active Model"
          value={healthData?.model || (isConnected ? "—" : "N/A")}
          icon={Cpu}
          color="bg-blue-500/15 text-blue-500"
        />
        <MetricCard
          label="Uptime"
          value={nebiusStats?.uptime_seconds ? formatUptime(nebiusStats.uptime_seconds) : isConnected ? "—" : "N/A"}
          icon={Clock}
          color="bg-teal-500/15 text-teal-500"
        />
        <MetricCard
          label="Devices"
          value={devices.length}
          icon={MonitorSmartphone}
          color="bg-purple-500/15 text-purple-500"
        />
        <MetricCard
          label="Credits"
          value={getTotalBalance(creditData) ?? "—"}
          icon={Coins}
          color="bg-yellow-500/15 text-yellow-500"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map(({ label, icon: Icon, path, description }) => (
          <Link key={path} to={path}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
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

      {/* Bottom row: Recent Activity + Devices */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Inference Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/history" className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentInferences.length === 0 ? (
              <div className="py-6 text-center">
                <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No inference history yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run your first prediction from the{" "}
                  <Link to="/dashboard/inference" className="text-primary hover:underline">
                    Inference
                  </Link>{" "}
                  page.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInferences.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-md bg-muted p-1.5">
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.model}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.object_count} object{entry.object_count !== 1 ? "s" : ""} detected
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {entry.inference_ms}ms
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(entry.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registered Devices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Registered Devices</CardTitle>
            {devices.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {devices.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <div className="py-6 text-center">
                <MonitorSmartphone className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No devices registered yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Devices will appear here when they connect to your server.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.device_type}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate ml-2 shrink-0 max-w-[200px]">
                      {device.server_url}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

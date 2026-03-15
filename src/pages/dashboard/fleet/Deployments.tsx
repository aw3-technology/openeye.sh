import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeploymentWizard } from "@/components/fleet/DeploymentWizard";
import { RolloutProgress } from "@/components/fleet/RolloutProgress";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import { useFleetDeployments } from "@/hooks/useFleetQueries";
import type { DeploymentStatus, DeploymentStrategy } from "@/types/fleet";
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  RotateCcw,
  Layers,
  ArrowRightLeft,
  Copy,
  Zap,
} from "lucide-react";

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  paused: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  rolling_back: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  rolled_back: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const strategyIcon: Record<DeploymentStrategy, typeof Rocket> = {
  canary: Layers,
  rolling: ArrowRightLeft,
  blue_green: Copy,
  all_at_once: Zap,
};

const strategyLabel: Record<DeploymentStrategy, string> = {
  canary: "Canary",
  rolling: "Rolling",
  blue_green: "Blue/Green",
  all_at_once: "All at Once",
};

type FilterTab = "all" | DeploymentStatus;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Deployments() {
  const { data: deployments, isLoading } = useFleetDeployments();
  const [filter, setFilter] = useState<FilterTab>("all");

  const counts = useMemo(() => {
    if (!deployments) return { total: 0, active: 0, completed: 0, failed: 0, paused: 0, pending: 0 };
    return {
      total: deployments.length,
      active: deployments.filter((d) => d.status === "in_progress").length,
      completed: deployments.filter((d) => d.status === "completed").length,
      failed: deployments.filter((d) => d.status === "failed" || d.status === "rolled_back").length,
      paused: deployments.filter((d) => d.status === "paused").length,
      pending: deployments.filter((d) => d.status === "pending").length,
    };
  }, [deployments]);

  const filtered = useMemo(() => {
    if (!deployments) return [];
    if (filter === "all") return deployments;
    if (filter === "failed") return deployments.filter((d) => d.status === "failed" || d.status === "rolled_back" || d.status === "rolling_back");
    return deployments.filter((d) => d.status === filter);
  }, [deployments, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deployments</h1>
          <p className="text-sm text-muted-foreground">Manage model rollouts across your fleet</p>
        </div>
        <DeploymentWizard />
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard icon={Rocket} label="Total" value={counts.total} color="bg-muted" />
        <MetricCard icon={Rocket} label="Active" value={counts.active} color="bg-teal-500/15 text-teal-500" />
        <MetricCard icon={Clock} label="Pending" value={counts.pending} color="bg-yellow-500/15 text-yellow-500" />
        <MetricCard icon={Pause} label="Paused" value={counts.paused} color="bg-blue-500/15 text-blue-500" />
        <MetricCard icon={CheckCircle2} label="Completed" value={counts.completed} color="bg-green-500/15 text-green-500" />
        <MetricCard icon={XCircle} label="Failed" value={counts.failed} color="bg-red-500/15 text-red-500" />
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="in_progress">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState message="Loading deployments..." className="py-12 text-center" />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Rocket className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <EmptyState
                message={filter === "all" ? "No deployments yet. Create one to start rolling out models." : `No ${filter.replace(/_/g, " ")} deployments.`}
                className="text-center"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((dep) => {
                  const StratIcon = strategyIcon[dep.strategy] || Rocket;
                  return (
                    <TableRow key={dep.id} className="group">
                      <TableCell>
                        <Link
                          to={`/dashboard/fleet/deployments/${dep.id}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {dep.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-medium">{dep.model_id}</span>
                          <span className="text-muted-foreground ml-1">v{dep.model_version}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <StratIcon className="h-3 w-3" />
                          {strategyLabel[dep.strategy] || dep.strategy}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[dep.status] || ""}`}
                        >
                          {dep.status === "in_progress" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                          )}
                          {dep.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {dep.target_device_ids.length}
                      </TableCell>
                      <TableCell className="w-48">
                        {dep.rollout_stages.length > 0 ? (
                          <RolloutProgress
                            stages={dep.rollout_stages}
                            currentStage={dep.current_stage}
                            status={dep.status}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">No stages</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {timeAgo(dep.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

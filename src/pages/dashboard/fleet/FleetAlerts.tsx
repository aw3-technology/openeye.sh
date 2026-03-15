import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useFleetAlerts, useResolveAlert } from "@/hooks/useFleetQueries";
import {
  Bell, BellOff, CheckCircle, AlertTriangle, AlertOctagon,
  Info, ShieldAlert, Clock, Filter,
} from "lucide-react";
import { toast } from "sonner";
import type { AlertSeverity, AlertType, FleetAlertResponse } from "@/types/fleet";

// ── Severity config ──────────────────────────────────────────────

const severityBadge: Record<AlertSeverity, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  critical: "bg-red-600/20 text-red-300 border-red-600/40",
};

const severityIcon: Record<AlertSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertOctagon,
  critical: ShieldAlert,
};

const alertTypeLabels: Record<AlertType, string> = {
  device_offline: "Device Offline",
  high_resource_usage: "High Resource Usage",
  deployment_failed: "Deployment Failed",
  ota_failed: "OTA Failed",
  heartbeat_missed: "Heartbeat Missed",
  temperature_high: "High Temperature",
  disk_full: "Disk Full",
};

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────

export default function FleetAlerts() {
  const { data: alerts, isLoading } = useFleetAlerts();
  const resolveMutation = useResolveAlert();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Computed counts
  const counts = useMemo(() => {
    const all = alerts ?? [];
    const unresolved = all.filter((a) => !a.resolved);
    return {
      total: all.length,
      unresolved: unresolved.length,
      resolved: all.length - unresolved.length,
      critical: unresolved.filter((a) => a.severity === "critical").length,
      error: unresolved.filter((a) => a.severity === "error").length,
      warning: unresolved.filter((a) => a.severity === "warning").length,
      info: unresolved.filter((a) => a.severity === "info").length,
    };
  }, [alerts]);

  // Filter logic
  const filterAlerts = (list: FleetAlertResponse[], resolved: boolean) => {
    return list
      .filter((a) => a.resolved === resolved)
      .filter((a) => severityFilter === "all" || a.severity === severityFilter)
      .filter((a) => typeFilter === "all" || a.alert_type === typeFilter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const activeAlerts = useMemo(
    () => filterAlerts(alerts ?? [], false),
    [alerts, severityFilter, typeFilter],
  );
  const resolvedAlerts = useMemo(
    () => filterAlerts(alerts ?? [], true),
    [alerts, severityFilter, typeFilter],
  );

  // Alert types present in current data for filter options
  const alertTypes = useMemo(() => {
    const types = new Set((alerts ?? []).map((a) => a.alert_type));
    return Array.from(types).sort();
  }, [alerts]);

  const renderTable = (rows: FleetAlertResponse[], showResolveAction: boolean) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead className="w-[160px]">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden lg:table-cell">Message</TableHead>
              <TableHead className="w-[100px]">Time</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading alerts...</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <BellOff className="h-5 w-5" />
                    <span className="text-sm">
                      {showResolveAction ? "No active alerts" : "No resolved alerts"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {rows.map((alert) => {
              const SevIcon = severityIcon[alert.severity];
              return (
                <TableRow key={alert.id} className={alert.severity === "critical" && !alert.resolved ? "bg-red-500/5" : undefined}>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${severityBadge[alert.severity]}`}>
                      <SevIcon className="h-3 w-3" />
                      {alert.severity}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {alertTypeLabels[alert.alert_type] ?? alert.alert_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{alert.title}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">
                    {alert.message}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums" title={new Date(alert.created_at).toLocaleString()}>
                    {timeAgo(alert.created_at)}
                  </TableCell>
                  <TableCell>
                    {showResolveAction && !alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          resolveMutation.mutate(alert.id, {
                            onSuccess: () => toast.success("Alert resolved"),
                          })
                        }
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    )}
                    {alert.resolved && alert.resolved_at && (
                      <span className="text-xs text-green-400" title={new Date(alert.resolved_at).toLocaleString()}>
                        Resolved {timeAgo(alert.resolved_at)}
                      </span>
                    )}
                    {alert.resolved && !alert.resolved_at && (
                      <span className="text-xs text-green-400">Resolved</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fleet Alerts</h1>
        {counts.unresolved > 0 && (
          <span className="text-sm text-muted-foreground">
            {counts.unresolved} unresolved alert{counts.unresolved !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard icon={Bell} label="Active" value={counts.unresolved} color="bg-amber-500/15 text-amber-500" />
        <MetricCard icon={ShieldAlert} label="Critical" value={counts.critical} color="bg-red-600/15 text-red-400" />
        <MetricCard icon={AlertOctagon} label="Errors" value={counts.error} color="bg-red-500/15 text-red-500" />
        <MetricCard icon={AlertTriangle} label="Warnings" value={counts.warning} color="bg-amber-500/15 text-amber-400" />
        <MetricCard icon={CheckCircle} label="Resolved" value={counts.resolved} color="bg-green-500/15 text-green-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Alert type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {alertTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {alertTypeLabels[t as AlertType] ?? t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(severityFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSeverityFilter("all");
              setTypeFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Tabs: Active / Resolved */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Active
            {counts.unresolved > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                {counts.unresolved}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Resolved
            {counts.resolved > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                {counts.resolved}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {renderTable(activeAlerts, true)}
        </TabsContent>

        <TabsContent value="resolved">
          {renderTable(resolvedAlerts, false)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

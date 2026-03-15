import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFleetAlerts, useResolveAlert } from "@/hooks/useFleetQueries";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { AlertSeverity } from "@/types/fleet";

const severityBadge: Record<AlertSeverity, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  critical: "bg-red-600/20 text-red-300 border-red-600/40",
};

export default function FleetAlerts() {
  const { data: alerts, isLoading } = useFleetAlerts();
  const resolveMutation = useResolveAlert();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fleet Alerts</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!isLoading && (!alerts || alerts.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No alerts</TableCell></TableRow>
              )}
              {(alerts || []).map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${severityBadge[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{alert.alert_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm font-medium">{alert.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{alert.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(alert.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate(alert.id, {
                          onSuccess: () => toast.success("Alert resolved"),
                        })}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    )}
                    {alert.resolved && <span className="text-xs text-green-400">Resolved</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

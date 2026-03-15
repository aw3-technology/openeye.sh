import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeploymentWizard } from "@/components/fleet/DeploymentWizard";
import { RolloutProgress } from "@/components/fleet/RolloutProgress";
import { useFleetDeployments } from "@/hooks/useFleetQueries";
import type { DeploymentStatus } from "@/types/fleet";

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  paused: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  rolling_back: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  rolled_back: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Deployments() {
  const { data: deployments, isLoading } = useFleetDeployments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deployments</h1>
        <DeploymentWizard />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!isLoading && (!deployments || deployments.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No deployments yet</TableCell></TableRow>
              )}
              {(deployments || []).map((dep) => (
                <TableRow key={dep.id}>
                  <TableCell>
                    <Link to={`/dashboard/fleet/deployments/${dep.id}`} className="font-medium hover:underline text-primary">
                      {dep.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{dep.model_id} v{dep.model_version}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dep.strategy}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[dep.status] || ""}`}>
                      {dep.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="w-48">
                    {dep.rollout_stages.length > 0 && (
                      <RolloutProgress stages={dep.rollout_stages} currentStage={dep.current_stage} status={dep.status} />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(dep.created_at).toLocaleDateString()}
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

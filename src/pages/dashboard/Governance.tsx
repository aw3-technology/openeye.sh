import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  AlertTriangle,
  Info,
} from "lucide-react";
import { GovernanceStatusBadge } from "@/components/dashboard/governance/GovernanceStatus";
import { PolicyList } from "@/components/dashboard/governance/PolicyList";
import { PresetSelector } from "@/components/dashboard/governance/PresetSelector";
import { ViolationLog } from "@/components/dashboard/governance/ViolationLog";
import { AuditTrail } from "@/components/dashboard/governance/AuditTrail";
import { PolicyEditor } from "@/components/dashboard/governance/PolicyEditor";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import {
  useGovernanceStatus,
  useGovernancePolicies,
  useAvailablePolicies,
} from "@/hooks/useGovernanceQueries";

export default function Governance() {
  const { isConnected } = useOpenEyeConnection();
  const { data: status, isLoading: statusLoading } = useGovernanceStatus();
  const { data: policies, isLoading: policiesLoading } = useGovernancePolicies();
  const { data: available } = useAvailablePolicies();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-lg font-medium text-muted-foreground">
            No server connected
          </p>
          <p className="text-sm text-muted-foreground/70">
            Connect to an OpenEye server to manage governance policies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Governance</h1>
            {status && (
              <div className="flex items-center gap-2 mt-0.5">
                {status.config_name && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {status.config_name}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-normal">
                  {status.domain}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-normal ${
                    status.fail_open
                      ? "border-yellow-500/30 text-yellow-400"
                      : "border-teal-500/30 text-teal-400"
                  }`}
                >
                  {status.fail_open ? "fail-open" : "fail-closed"}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <GovernanceStatusBadge status={status} isLoading={statusLoading} />
      </div>

      {/* Metrics row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Policies"
          value={status?.enabled_policies ?? 0}
          description={status ? `${status.total_policies} total` : undefined}
          icon={ShieldCheck}
          color="bg-teal-500/15"
        />
        <MetricCard
          label="Total Evaluations"
          value={status?.total_evaluations ?? 0}
          icon={Activity}
          color="bg-blue-500/15"
        />
        <MetricCard
          label="Violations"
          value={status?.total_violations ?? 0}
          icon={ShieldX}
          color="bg-red-500/15"
        />
        <MetricCard
          label="Warnings"
          value={status?.total_warnings ?? 0}
          icon={ShieldAlert}
          color="bg-yellow-500/15"
        />
      </div>

      {/* Info banner when inactive */}
      {status && !status.active && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-yellow-400">Governance engine is inactive</p>
            <p className="text-muted-foreground mt-0.5">
              Load a preset or apply a YAML configuration to activate the governance engine.
            </p>
          </div>
        </div>
      )}

      {/* Tip banner when no policies */}
      {status && status.active && status.enabled_policies === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-400">No policies enabled</p>
            <p className="text-muted-foreground mt-0.5">
              Select a preset below or enable individual policies from the Available tab.
            </p>
          </div>
        </div>
      )}

      {/* Preset selector */}
      <PresetSelector />

      {/* Policy list + Violation log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyList
          policies={policies}
          availablePolicies={available}
          isLoading={policiesLoading}
        />
        <ViolationLog />
      </div>

      {/* Audit trail */}
      <AuditTrail />

      {/* Policy editor */}
      <PolicyEditor />
    </div>
  );
}

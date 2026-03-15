import { Shield } from "lucide-react";
import { GovernanceStatusBadge } from "@/components/dashboard/governance/GovernanceStatus";
import { PolicyList } from "@/components/dashboard/governance/PolicyList";
import { PresetSelector } from "@/components/dashboard/governance/PresetSelector";
import { ViolationLog } from "@/components/dashboard/governance/ViolationLog";
import { AuditTrail } from "@/components/dashboard/governance/AuditTrail";
import { PolicyEditor } from "@/components/dashboard/governance/PolicyEditor";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  useGovernanceStatus,
  useGovernancePolicies,
} from "@/hooks/useGovernanceQueries";

export default function Governance() {
  const { data: status, isLoading: statusLoading } = useGovernanceStatus();
  const { data: policies, isLoading: policiesLoading } = useGovernancePolicies();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Governance</h1>
        </div>
        <GovernanceStatusBadge status={status} isLoading={statusLoading} />
      </div>

      {/* Metrics row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Policies"
          value={status?.enabled_policies ?? 0}
          icon={Shield}
          color="bg-teal-500/15"
        />
        <MetricCard
          label="Total Evaluations"
          value={status?.total_evaluations ?? 0}
          icon={Shield}
          color="bg-blue-500/15"
        />
        <MetricCard
          label="Violations"
          value={status?.total_violations ?? 0}
          icon={Shield}
          color="bg-red-500/15"
        />
        <MetricCard
          label="Warnings"
          value={status?.total_warnings ?? 0}
          icon={Shield}
          color="bg-yellow-500/15"
        />
      </div>

      {/* Preset selector */}
      <PresetSelector />

      {/* Policy list + Violation log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyList policies={policies} isLoading={policiesLoading} />
        <ViolationLog />
      </div>

      {/* Audit trail */}
      <AuditTrail />

      {/* Policy editor */}
      <PolicyEditor />
    </div>
  );
}

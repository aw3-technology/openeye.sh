import { Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { GovernanceStatus as GovernanceStatusType } from "@/types/governance";

const statusConfig = {
  active: { icon: ShieldCheck, color: "text-teal-400", bg: "bg-teal-500/15", label: "COMPLIANT" },
  warning: { icon: ShieldAlert, color: "text-yellow-400", bg: "bg-yellow-500/15", label: "WARNING" },
  violation: { icon: ShieldX, color: "text-red-400", bg: "bg-red-500/15", label: "VIOLATION" },
  inactive: { icon: Shield, color: "text-gray-400", bg: "bg-gray-500/15", label: "INACTIVE" },
};

interface Props {
  status: GovernanceStatusType | undefined;
  isLoading: boolean;
}

export function GovernanceStatusBadge({ status, isLoading }: Props) {
  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <Shield className="h-5 w-5 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const state = !status.active
    ? "inactive"
    : status.total_violations > 0
      ? "violation"
      : status.total_warnings > 0
        ? "warning"
        : "active";

  const config = statusConfig[state];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-border ${config.bg} px-3 py-2`}>
      <Icon className={`h-5 w-5 ${config.color}`} />
      <div>
        <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
        <p className="text-xs text-muted-foreground">
          {status.enabled_policies}/{status.total_policies} policies
          {" · "}{status.total_evaluations} evals
        </p>
      </div>
    </div>
  );
}

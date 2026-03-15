import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PolicyInfo } from "@/types/governance";
import { useEnablePolicy, useDisablePolicy } from "@/hooks/useGovernanceQueries";

const severityBadge: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  info: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const domainBadge: Record<string, string> = {
  robotics: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  desktop_agent: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  universal: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

interface Props {
  policies: PolicyInfo[] | undefined;
  isLoading: boolean;
}

export function PolicyList({ policies, isLoading }: Props) {
  const enablePolicy = useEnablePolicy();
  const disablePolicy = useDisablePolicy();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Policies</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading policies...</p>}
        {!isLoading && (!policies || policies.length === 0) && (
          <p className="text-sm text-muted-foreground">No policies configured. Load a preset to get started.</p>
        )}
        <div className="space-y-2">
          {(policies || []).map((policy) => (
            <div
              key={policy.name}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{policy.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${
                        domainBadge[policy.domain] || domainBadge.universal
                      }`}
                    >
                      {policy.domain}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${
                        severityBadge[policy.severity] || severityBadge.medium
                      }`}
                    >
                      {policy.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{policy.enforcement}</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={policy.enabled ? "destructive" : "default"}
                className="h-7 text-xs"
                onClick={() =>
                  policy.enabled
                    ? disablePolicy.mutate(policy.name)
                    : enablePolicy.mutate(policy.name)
                }
                disabled={enablePolicy.isPending || disablePolicy.isPending}
              >
                {policy.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

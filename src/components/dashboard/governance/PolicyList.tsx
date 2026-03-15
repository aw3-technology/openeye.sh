import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PolicyInfo } from "@/types/governance";
import { useEnablePolicy, useDisablePolicy } from "@/hooks/useGovernanceQueries";
import { Puzzle } from "lucide-react";

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

function PolicyRow({ policy }: { policy: PolicyInfo }) {
  const enablePolicy = useEnablePolicy();
  const disablePolicy = useDisablePolicy();

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{policy.name}</p>
            {policy.is_plugin && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0 text-[10px] font-medium text-indigo-400">
                <Puzzle className="h-2.5 w-2.5" />
                plugin
              </span>
            )}
          </div>
          {policy.description && (
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {policy.description}
            </p>
          )}
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
        className="h-7 text-xs shrink-0 ml-2"
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
  );
}

interface Props {
  policies: PolicyInfo[] | undefined;
  availablePolicies: PolicyInfo[] | undefined;
  isLoading: boolean;
}

export function PolicyList({ policies, availablePolicies, isLoading }: Props) {
  const enabledPolicies = policies || [];
  const disabledPolicies = (availablePolicies || []).filter(
    (p) => !enabledPolicies.some((ep) => ep.name === p.name),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policies</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading policies...</p>}
        {!isLoading && (
          <Tabs defaultValue="active" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">
                Active ({enabledPolicies.length})
              </TabsTrigger>
              <TabsTrigger value="available">
                Available ({disabledPolicies.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-2 mt-0">
              {enabledPolicies.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active policies. Load a preset or enable one from the Available tab.
                </p>
              )}
              {enabledPolicies.map((policy) => (
                <PolicyRow key={policy.name} policy={policy} />
              ))}
            </TabsContent>

            <TabsContent value="available" className="space-y-2 mt-0">
              {disabledPolicies.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  All policies are currently active.
                </p>
              )}
              {disabledPolicies.map((policy) => (
                <PolicyRow key={policy.name} policy={policy} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

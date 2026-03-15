/**
 * React Query hooks for governance API.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { GovernanceClient } from "@/lib/governance-client";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { toast } from "sonner";

function useGovernanceClient(): GovernanceClient | null {
  const { serverUrl, isConnected } = useOpenEyeConnection();
  return useMemo(
    () => (isConnected ? new GovernanceClient(serverUrl) : null),
    [serverUrl, isConnected],
  );
}

export function useGovernanceStatus() {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "status"],
    queryFn: () => client!.getStatus(),
    enabled: !!client,
    refetchInterval: 5_000,
  });
}

export function useGovernancePolicies() {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "policies"],
    queryFn: () => client!.listPolicies(),
    enabled: !!client,
    refetchInterval: 10_000,
  });
}

export function useGovernancePresets() {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "presets"],
    queryFn: () => client!.listPresets(),
    enabled: !!client,
  });
}

export function useGovernanceConfig() {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "config"],
    queryFn: () => client!.getConfig(),
    enabled: !!client,
  });
}

export function useGovernanceAudit(limit = 50) {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "audit", limit],
    queryFn: () => client!.getAudit(limit),
    enabled: !!client,
    refetchInterval: 5_000,
  });
}

export function useGovernanceViolations(limit = 50) {
  const client = useGovernanceClient();
  return useQuery({
    queryKey: ["governance", "violations", limit],
    queryFn: () => client!.getViolations(limit),
    enabled: !!client,
    refetchInterval: 3_000,
  });
}

export function useEnablePolicy() {
  const client = useGovernanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => client!.enablePolicy(name),
    onError: (err) => toast.error("Failed to enable policy", { description: String(err) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["governance", "policies"] });
      qc.invalidateQueries({ queryKey: ["governance", "status"] });
    },
  });
}

export function useDisablePolicy() {
  const client = useGovernanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => client!.disablePolicy(name),
    onError: (err) => toast.error("Failed to disable policy", { description: String(err) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["governance", "policies"] });
      qc.invalidateQueries({ queryKey: ["governance", "status"] });
    },
  });
}

export function useLoadPreset() {
  const client = useGovernanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => client!.loadPreset(name),
    onSuccess: (_, name) => toast.success(`Loaded preset: ${name}`),
    onError: (err) => toast.error("Failed to load preset", { description: String(err) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
  });
}

export function useUpdateGovernanceConfig() {
  const client = useGovernanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yaml: string) => client!.updateConfig(yaml),
    onSuccess: () => toast.success("Governance config updated"),
    onError: (err) => toast.error("Invalid config", { description: String(err) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
  });
}

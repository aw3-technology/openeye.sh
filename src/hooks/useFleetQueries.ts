/**
 * React Query hooks for fleet management data.
 * Follows the same pattern as useOpenEyeQueries.ts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { FleetClient, getStoredFleetUrl } from "@/lib/fleet-client";
import { toastMutationError } from "@/lib/utils";
import type {
  DeploymentCreateRequest,
  DeviceGroupCreateRequest,
  DeviceRegisterRequest,
  DeviceUpdateRequest,
  MaintenanceWindowCreateRequest,
  OTAUpdateRequest,
  AutoScalingPolicy,
  FleetSummary,
} from "@/types/fleet";

function useFleetClient(): FleetClient | null {
  const { session } = useAuth();
  return useMemo(() => {
    if (!session?.access_token) return null;
    return new FleetClient(getStoredFleetUrl(), session.access_token);
  }, [session?.access_token]);
}

function requireClient(client: FleetClient | null): FleetClient {
  if (!client) throw new Error("Fleet client unavailable — session may have expired. Please sign in again.");
  return client;
}

// ── Devices ────────────────────────────────────────────────────

export function useFleetDevices(params?: { status?: string; device_type?: string }) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "devices", params],
    queryFn: () => client!.listDevices(params),
    enabled: !!client,
    refetchInterval: 15_000,
  });
}

export function useFleetDevice(deviceId: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "device", deviceId],
    queryFn: () => client!.getDevice(deviceId),
    enabled: !!client && !!deviceId,
    refetchInterval: 10_000,
  });
}

export function useRegisterDevice() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeviceRegisterRequest) => requireClient(client).registerDevice(req),
    onError: (err) => toastMutationError("Device registration", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "devices"] }),
  });
}

export function useUpdateDevice() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, req }: { deviceId: string; req: DeviceUpdateRequest }) =>
      requireClient(client).updateDevice(deviceId, req),
    onError: (err) => toastMutationError("Device update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "devices"] });
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useSetDeviceTags() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, tags }: { deviceId: string; tags: Record<string, string> }) =>
      requireClient(client).setTags(deviceId, tags),
    onError: (err) => toastMutationError("Tag update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useSetDeviceConfig() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, config }: { deviceId: string; config: Record<string, unknown> }) =>
      requireClient(client).setConfigOverrides(deviceId, config),
    onError: (err) => toastMutationError("Config update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useDeviceResourceHistory(deviceId: string, limit = 100) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "resources", deviceId, limit],
    queryFn: () => client!.getResourceHistory(deviceId, limit),
    enabled: !!client && !!deviceId,
    refetchInterval: 15_000,
  });
}

export function useRestartDevice() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => requireClient(client).restartDevice(deviceId),
    onError: (err) => toastMutationError("Device restart", err),
    onSettled: (_, __, deviceId) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useDecommissionDevice() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, reason, wipeData }: { deviceId: string; reason?: string; wipeData?: boolean }) =>
      requireClient(client).decommissionDevice(deviceId, { reason, wipe_data: wipeData }),
    onError: (err) => toastMutationError("Device decommission", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "devices"] }),
  });
}

// ── Deployments ────────────────────────────────────────────────

export function useFleetDeployments(status?: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "deployments", status],
    queryFn: () => client!.listDeployments(status),
    enabled: !!client,
    refetchInterval: 10_000,
  });
}

export function useFleetDeployment(deploymentId: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "deployment", deploymentId],
    queryFn: () => client!.getDeployment(deploymentId),
    enabled: !!client && !!deploymentId,
    refetchInterval: 5_000,
  });
}

export function useDeploymentDevices(deploymentId: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "deployment", deploymentId, "devices"],
    queryFn: () => client!.getDeploymentDevices(deploymentId),
    enabled: !!client && !!deploymentId,
    refetchInterval: 5_000,
  });
}

export function useCreateDeployment() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeploymentCreateRequest) => requireClient(client).createDeployment(req),
    onError: (err) => toastMutationError("Deployment creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "deployments"] }),
  });
}

export function useAdvanceDeployment() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requireClient(client).advanceDeployment(id),
    onError: (err) => toastMutationError("Deployment advance", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

export function usePauseDeployment() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requireClient(client).pauseDeployment(id),
    onError: (err) => toastMutationError("Deployment pause", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

export function useRollbackDeployment() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requireClient(client).rollbackDeployment(id),
    onError: (err) => toastMutationError("Deployment rollback", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

// ── Groups ─────────────────────────────────────────────────────

export function useFleetGroups() {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "groups"],
    queryFn: () => client!.listGroups(),
    enabled: !!client,
  });
}

export function useCreateGroup() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeviceGroupCreateRequest) => requireClient(client).createGroup(req),
    onError: (err) => toastMutationError("Group creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "groups"] }),
  });
}

export function useFleetGroup(groupId: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "group", groupId],
    queryFn: () => client!.getGroup(groupId),
    enabled: !!client && !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "group", groupId, "members"],
    queryFn: () => client!.listGroupMembers(groupId),
    enabled: !!client && !!groupId,
    refetchInterval: 15_000,
  });
}

export function useDeleteGroup() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => requireClient(client).deleteGroup(groupId),
    onError: (err) => toastMutationError("Group deletion", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "groups"] }),
  });
}

export function useAddGroupMember() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, deviceId }: { groupId: string; deviceId: string }) =>
      requireClient(client).addGroupMember(groupId, deviceId),
    onError: (err) => toastMutationError("Add member", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
    },
  });
}

export function useRemoveGroupMember() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, deviceId }: { groupId: string; deviceId: string }) =>
      requireClient(client).removeGroupMember(groupId, deviceId),
    onError: (err) => toastMutationError("Remove member", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
    },
  });
}

export function useSetScalingPolicy() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, policy }: { groupId: string; policy: AutoScalingPolicy }) =>
      requireClient(client).setScalingPolicy(groupId, policy),
    onError: (err) => toastMutationError("Scaling policy update", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId] });
    },
  });
}

// ── Maintenance ────────────────────────────────────────────────

export function useMaintenanceWindows(activeOnly = false) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "maintenance", activeOnly],
    queryFn: () => client!.listMaintenanceWindows(activeOnly),
    enabled: !!client,
  });
}

export function useCreateMaintenanceWindow() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: MaintenanceWindowCreateRequest) => requireClient(client).createMaintenanceWindow(req),
    onError: (err) => toastMutationError("Maintenance window creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "maintenance"] }),
  });
}

export function useDeleteMaintenanceWindow() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requireClient(client).deleteMaintenanceWindow(id),
    onError: (err) => toastMutationError("Maintenance window deletion", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "maintenance"] }),
  });
}

// ── Alerts ─────────────────────────────────────────────────────

export function useFleetAlerts(resolved?: boolean) {
  const client = useFleetClient();
  return useQuery({
    queryKey: ["fleet", "alerts", resolved],
    queryFn: () => client!.listAlerts(resolved),
    enabled: !!client,
    refetchInterval: 15_000,
  });
}

export function useResolveAlert() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requireClient(client).resolveAlert(id),
    onError: (err) => toastMutationError("Alert resolution", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "alerts"] }),
  });
}

// ── OTA ────────────────────────────────────────────────────────

export function usePushOTAUpdate() {
  const client = useFleetClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: OTAUpdateRequest) => requireClient(client).pushOTAUpdate(req),
    onError: (err) => toastMutationError("OTA update", err),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["fleet", "devices"] });
    },
  });
}

// ── Summary ────────────────────────────────────────────────────

export function useFleetSummary(): FleetSummary | null {
  const { data: devices } = useFleetDevices();
  const { data: deployments } = useFleetDeployments();
  const { data: alerts } = useFleetAlerts(false);

  if (!devices) return null;

  return {
    total_devices: devices.length,
    online_devices: devices.filter((d) => d.status === "online").length,
    offline_devices: devices.filter((d) => d.status === "offline").length,
    error_devices: devices.filter((d) => d.status === "error").length,
    active_deployments: deployments?.filter((d) => d.status === "in_progress").length ?? 0,
    unresolved_alerts: alerts?.length ?? 0,
  };
}

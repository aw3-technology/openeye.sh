/**
 * React Query hooks for fleet management data.
 * Uses Supabase-backed fleet client (no local server required).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { toastMutationError } from "@/lib/utils";
import * as fleet from "@/lib/fleet-client";
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

// ── Devices ────────────────────────────────────────────────────

export function useFleetDevices(params?: { status?: string; device_type?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "devices", params],
    queryFn: () => fleet.listDevices(params),
    enabled: !!user,
    refetchInterval: 15_000,
  });
}

export function useFleetDevice(deviceId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "device", deviceId],
    queryFn: () => fleet.getDevice(deviceId),
    enabled: !!user && !!deviceId,
    refetchInterval: 10_000,
  });
}

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeviceRegisterRequest) => fleet.registerDevice(req),
    onError: (err) => toastMutationError("Device registration", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "devices"] }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, req }: { deviceId: string; req: DeviceUpdateRequest }) =>
      fleet.updateDevice(deviceId, req),
    onError: (err) => toastMutationError("Device update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "devices"] });
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useSetDeviceTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, tags }: { deviceId: string; tags: Record<string, string> }) =>
      fleet.setTags(deviceId, tags),
    onError: (err) => toastMutationError("Tag update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useSetDeviceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, config }: { deviceId: string; config: Record<string, unknown> }) =>
      fleet.setConfigOverrides(deviceId, config),
    onError: (err) => toastMutationError("Config update", err),
    onSettled: (_, __, { deviceId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useDeviceResourceHistory(deviceId: string, limit = 100) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "resources", deviceId, limit],
    queryFn: () => fleet.getResourceHistory(deviceId, limit),
    enabled: !!user && !!deviceId,
    refetchInterval: 15_000,
  });
}

export function useRestartDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => fleet.restartDevice(deviceId),
    onError: (err) => toastMutationError("Device restart", err),
    onSettled: (_, __, deviceId) => {
      qc.invalidateQueries({ queryKey: ["fleet", "device", deviceId] });
    },
  });
}

export function useDecommissionDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, reason, wipeData }: { deviceId: string; reason?: string; wipeData?: boolean }) =>
      fleet.decommissionDevice(deviceId, { reason, wipe_data: wipeData }),
    onError: (err) => toastMutationError("Device decommission", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "devices"] }),
  });
}

// ── Deployments ────────────────────────────────────────────────

export function useFleetDeployments(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "deployments", status],
    queryFn: () => fleet.listDeployments(status),
    enabled: !!user,
    refetchInterval: 10_000,
  });
}

export function useFleetDeployment(deploymentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "deployment", deploymentId],
    queryFn: () => fleet.getDeployment(deploymentId),
    enabled: !!user && !!deploymentId,
    refetchInterval: 5_000,
  });
}

export function useDeploymentDevices(deploymentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "deployment", deploymentId, "devices"],
    queryFn: () => fleet.getDeploymentDevices(deploymentId),
    enabled: !!user && !!deploymentId,
    refetchInterval: 5_000,
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeploymentCreateRequest) => fleet.createDeployment(req),
    onError: (err) => toastMutationError("Deployment creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "deployments"] }),
  });
}

export function useAdvanceDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fleet.advanceDeployment(id),
    onError: (err) => toastMutationError("Deployment advance", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

export function usePauseDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fleet.pauseDeployment(id),
    onError: (err) => toastMutationError("Deployment pause", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

export function useRollbackDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fleet.rollbackDeployment(id),
    onError: (err) => toastMutationError("Deployment rollback", err),
    onSettled: (_, __, id) => {
      qc.invalidateQueries({ queryKey: ["fleet", "deployment", id] });
      qc.invalidateQueries({ queryKey: ["fleet", "deployments"] });
    },
  });
}

// ── Groups ─────────────────────────────────────────────────────

export function useFleetGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "groups"],
    queryFn: () => fleet.listGroups(),
    enabled: !!user,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeviceGroupCreateRequest) => fleet.createGroup(req),
    onError: (err) => toastMutationError("Group creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "groups"] }),
  });
}

export function useFleetGroup(groupId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "group", groupId],
    queryFn: () => fleet.getGroup(groupId),
    enabled: !!user && !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "group", groupId, "members"],
    queryFn: () => fleet.listGroupMembers(groupId),
    enabled: !!user && !!groupId,
    refetchInterval: 15_000,
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => fleet.deleteGroup(groupId),
    onError: (err) => toastMutationError("Group deletion", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "groups"] }),
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, deviceId }: { groupId: string; deviceId: string }) =>
      fleet.addGroupMember(groupId, deviceId),
    onError: (err) => toastMutationError("Add member", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, deviceId }: { groupId: string; deviceId: string }) =>
      fleet.removeGroupMember(groupId, deviceId),
    onError: (err) => toastMutationError("Remove member", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
    },
  });
}

export function useSetScalingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, policy }: { groupId: string; policy: AutoScalingPolicy }) =>
      fleet.setScalingPolicy(groupId, policy),
    onError: (err) => toastMutationError("Scaling policy update", err),
    onSettled: (_, __, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["fleet", "groups"] });
      qc.invalidateQueries({ queryKey: ["fleet", "group", groupId] });
    },
  });
}

// ── Maintenance ────────────────────────────────────────────────

export function useMaintenanceWindows(activeOnly = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "maintenance", activeOnly],
    queryFn: () => fleet.listMaintenanceWindows(activeOnly),
    enabled: !!user,
  });
}

export function useCreateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: MaintenanceWindowCreateRequest) => fleet.createMaintenanceWindow(req),
    onError: (err) => toastMutationError("Maintenance window creation", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "maintenance"] }),
  });
}

export function useDeleteMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fleet.deleteMaintenanceWindow(id),
    onError: (err) => toastMutationError("Maintenance window deletion", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "maintenance"] }),
  });
}

// ── Alerts ─────────────────────────────────────────────────────

export function useFleetAlerts(resolved?: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fleet", "alerts", resolved],
    queryFn: () => fleet.listAlerts(resolved),
    enabled: !!user,
    refetchInterval: 15_000,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fleet.resolveAlert(id),
    onError: (err) => toastMutationError("Alert resolution", err),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fleet", "alerts"] }),
  });
}

// ── OTA ────────────────────────────────────────────────────────

export function usePushOTAUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: OTAUpdateRequest) => fleet.pushOTAUpdate(req),
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

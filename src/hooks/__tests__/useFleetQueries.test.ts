import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mock dependencies ───────────────────────────────────────────

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" } })),
}));

vi.mock("@/lib/utils", () => ({
  toastMutationError: vi.fn(),
}));

const mockFleet = {
  listDevices: vi.fn(),
  getDevice: vi.fn(),
  registerDevice: vi.fn(),
  updateDevice: vi.fn(),
  setTags: vi.fn(),
  setConfigOverrides: vi.fn(),
  getResourceHistory: vi.fn(),
  restartDevice: vi.fn(),
  decommissionDevice: vi.fn(),
  listDeployments: vi.fn(),
  getDeployment: vi.fn(),
  getDeploymentDevices: vi.fn(),
  createDeployment: vi.fn(),
  advanceDeployment: vi.fn(),
  pauseDeployment: vi.fn(),
  rollbackDeployment: vi.fn(),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  listGroupMembers: vi.fn(),
  deleteGroup: vi.fn(),
  addGroupMember: vi.fn(),
  removeGroupMember: vi.fn(),
  setScalingPolicy: vi.fn(),
  listMaintenanceWindows: vi.fn(),
  createMaintenanceWindow: vi.fn(),
  updateMaintenanceWindow: vi.fn(),
  deleteMaintenanceWindow: vi.fn(),
  listAlerts: vi.fn(),
  resolveAlert: vi.fn(),
  pushOTAUpdate: vi.fn(),
};

vi.mock("@/lib/fleet-client", () => mockFleet);

import {
  useFleetDevices,
  useFleetDevice,
  useRegisterDevice,
  useUpdateDevice,
  useSetDeviceTags,
  useRestartDevice,
  useDecommissionDevice,
  useFleetDeployments,
  useFleetDeployment,
  useCreateDeployment,
  useAdvanceDeployment,
  usePauseDeployment,
  useRollbackDeployment,
  useFleetGroups,
  useCreateGroup,
  useFleetGroup,
  useGroupMembers,
  useDeleteGroup,
  useAddGroupMember,
  useRemoveGroupMember,
  useMaintenanceWindows,
  useCreateMaintenanceWindow,
  useFleetAlerts,
  useResolveAlert,
  usePushOTAUpdate,
  useFleetSummary,
} from "@/hooks/useFleetQueries";

// ── Test wrapper ────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const now = new Date().toISOString();
const fakeDevice = { id: "dev-1", name: "cam-1", status: "online", device_type: "camera" };
const fakeDeployment = { id: "dep-1", name: "yolov8-deploy", status: "in_progress" };
const fakeGroup = { id: "grp-1", name: "Warehouse A" };
const fakeAlert = { id: "alert-1", severity: "warning", resolved: false };

// ── Tests ───────────────────────────────────────────────────────

describe("useFleetQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Device queries ─────────────────────────────────────────────

  describe("useFleetDevices", () => {
    it("fetches devices list", async () => {
      mockFleet.listDevices.mockResolvedValue([fakeDevice]);
      const { result } = renderHook(() => useFleetDevices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].id).toBe("dev-1");
    });

    it("passes filter params", async () => {
      mockFleet.listDevices.mockResolvedValue([]);
      const { result } = renderHook(() => useFleetDevices({ status: "online" }), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.listDevices).toHaveBeenCalledWith({ status: "online" });
    });
  });

  describe("useFleetDevice", () => {
    it("fetches single device", async () => {
      mockFleet.getDevice.mockResolvedValue(fakeDevice);
      const { result } = renderHook(() => useFleetDevice("dev-1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.id).toBe("dev-1");
    });

    it("is disabled when deviceId is empty", () => {
      const { result } = renderHook(() => useFleetDevice(""), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  // ── Device mutations ───────────────────────────────────────────

  describe("useRegisterDevice", () => {
    it("calls fleet.registerDevice", async () => {
      mockFleet.registerDevice.mockResolvedValue(fakeDevice);
      const { result } = renderHook(() => useRegisterDevice(), { wrapper: createWrapper() });
      result.current.mutate({ name: "cam-1", device_type: "camera" } as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.registerDevice).toHaveBeenCalled();
    });
  });

  describe("useUpdateDevice", () => {
    it("calls fleet.updateDevice with deviceId and req", async () => {
      mockFleet.updateDevice.mockResolvedValue(fakeDevice);
      const { result } = renderHook(() => useUpdateDevice(), { wrapper: createWrapper() });
      result.current.mutate({ deviceId: "dev-1", req: { name: "cam-2" } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.updateDevice).toHaveBeenCalledWith("dev-1", { name: "cam-2" });
    });
  });

  describe("useSetDeviceTags", () => {
    it("calls fleet.setTags", async () => {
      mockFleet.setTags.mockResolvedValue(fakeDevice);
      const { result } = renderHook(() => useSetDeviceTags(), { wrapper: createWrapper() });
      result.current.mutate({ deviceId: "dev-1", tags: { zone: "dock" } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.setTags).toHaveBeenCalledWith("dev-1", { zone: "dock" });
    });
  });

  describe("useRestartDevice", () => {
    it("calls fleet.restartDevice", async () => {
      mockFleet.restartDevice.mockResolvedValue({ command_id: "cmd-1" });
      const { result } = renderHook(() => useRestartDevice(), { wrapper: createWrapper() });
      result.current.mutate("dev-1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.restartDevice).toHaveBeenCalledWith("dev-1");
    });
  });

  describe("useDecommissionDevice", () => {
    it("calls fleet.decommissionDevice with options", async () => {
      mockFleet.decommissionDevice.mockResolvedValue({ ...fakeDevice, status: "decommissioned" });
      const { result } = renderHook(() => useDecommissionDevice(), { wrapper: createWrapper() });
      result.current.mutate({ deviceId: "dev-1", reason: "EOL", wipeData: true });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.decommissionDevice).toHaveBeenCalledWith("dev-1", {
        reason: "EOL",
        wipe_data: true,
      });
    });
  });

  // ── Deployment queries & mutations ─────────────────────────────

  describe("useFleetDeployments", () => {
    it("fetches deployments list", async () => {
      mockFleet.listDeployments.mockResolvedValue([fakeDeployment]);
      const { result } = renderHook(() => useFleetDeployments(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useCreateDeployment", () => {
    it("calls fleet.createDeployment", async () => {
      mockFleet.createDeployment.mockResolvedValue(fakeDeployment);
      const { result } = renderHook(() => useCreateDeployment(), { wrapper: createWrapper() });
      result.current.mutate({ name: "deploy-1", model_id: "yolov8", model_version: "1.0" } as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useRollbackDeployment", () => {
    it("calls fleet.rollbackDeployment", async () => {
      mockFleet.rollbackDeployment.mockResolvedValue({ ...fakeDeployment, status: "rolling_back" });
      const { result } = renderHook(() => useRollbackDeployment(), { wrapper: createWrapper() });
      result.current.mutate("dep-1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.rollbackDeployment).toHaveBeenCalledWith("dep-1");
    });
  });

  // ── Group queries & mutations ──────────────────────────────────

  describe("useFleetGroups", () => {
    it("fetches groups list", async () => {
      mockFleet.listGroups.mockResolvedValue([fakeGroup]);
      const { result } = renderHook(() => useFleetGroups(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useCreateGroup", () => {
    it("calls fleet.createGroup", async () => {
      mockFleet.createGroup.mockResolvedValue(fakeGroup);
      const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() });
      result.current.mutate({ name: "Group B", description: "" } as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useDeleteGroup", () => {
    it("calls fleet.deleteGroup", async () => {
      mockFleet.deleteGroup.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteGroup(), { wrapper: createWrapper() });
      result.current.mutate("grp-1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.deleteGroup).toHaveBeenCalledWith("grp-1");
    });
  });

  describe("useAddGroupMember", () => {
    it("calls fleet.addGroupMember", async () => {
      mockFleet.addGroupMember.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAddGroupMember(), { wrapper: createWrapper() });
      result.current.mutate({ groupId: "grp-1", deviceId: "dev-1" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.addGroupMember).toHaveBeenCalledWith("grp-1", "dev-1");
    });
  });

  // ── Maintenance ────────────────────────────────────────────────

  describe("useMaintenanceWindows", () => {
    it("fetches maintenance windows", async () => {
      mockFleet.listMaintenanceWindows.mockResolvedValue([{ id: "maint-1" }]);
      const { result } = renderHook(() => useMaintenanceWindows(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.listMaintenanceWindows).toHaveBeenCalledWith(false);
    });

    it("passes activeOnly flag", async () => {
      mockFleet.listMaintenanceWindows.mockResolvedValue([]);
      const { result } = renderHook(() => useMaintenanceWindows(true), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.listMaintenanceWindows).toHaveBeenCalledWith(true);
    });
  });

  // ── Alerts ─────────────────────────────────────────────────────

  describe("useFleetAlerts", () => {
    it("fetches alerts", async () => {
      mockFleet.listAlerts.mockResolvedValue([fakeAlert]);
      const { result } = renderHook(() => useFleetAlerts(false), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useResolveAlert", () => {
    it("calls fleet.resolveAlert", async () => {
      mockFleet.resolveAlert.mockResolvedValue({ ...fakeAlert, resolved: true });
      const { result } = renderHook(() => useResolveAlert(), { wrapper: createWrapper() });
      result.current.mutate("alert-1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFleet.resolveAlert).toHaveBeenCalledWith("alert-1");
    });
  });

  // ── OTA ────────────────────────────────────────────────────────

  describe("usePushOTAUpdate", () => {
    it("calls fleet.pushOTAUpdate", async () => {
      mockFleet.pushOTAUpdate.mockResolvedValue({ status: "ota_queued" });
      const { result } = renderHook(() => usePushOTAUpdate(), { wrapper: createWrapper() });
      result.current.mutate({ device_ids: ["dev-1"], firmware_version: "2.0" } as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});

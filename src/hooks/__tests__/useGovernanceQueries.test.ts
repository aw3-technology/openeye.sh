import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mock dependencies ───────────────────────────────────────────

const mockClient = {
  getStatus: vi.fn(),
  listPolicies: vi.fn(),
  listAvailablePolicies: vi.fn(),
  listPresets: vi.fn(),
  getConfig: vi.fn(),
  getAudit: vi.fn(),
  getViolations: vi.fn(),
  enablePolicy: vi.fn(),
  disablePolicy: vi.fn(),
  loadPreset: vi.fn(),
  updateConfig: vi.fn(),
};

vi.mock("@/lib/governance-client", () => ({
  GovernanceClient: vi.fn(() => mockClient),
}));

vi.mock("@/hooks/useOpenEyeConnection", () => ({
  useOpenEyeConnection: vi.fn(() => ({
    serverUrl: "http://localhost:8000",
    isConnected: true,
  })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import {
  useGovernanceStatus,
  useGovernancePolicies,
  useAvailablePolicies,
  useGovernancePresets,
  useGovernanceConfig,
  useGovernanceAudit,
  useGovernanceViolations,
  useEnablePolicy,
  useDisablePolicy,
  useLoadPreset,
  useUpdateGovernanceConfig,
} from "@/hooks/useGovernanceQueries";

// ── Test wrapper ────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

// ── Tests ───────────────────────────────────────────────────────

describe("useGovernanceQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGovernanceStatus", () => {
    it("fetches governance status", async () => {
      mockClient.getStatus.mockResolvedValue({
        active: true,
        enabled_policies: 3,
        total_evaluations: 100,
      });
      const { result } = renderHook(() => useGovernanceStatus(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.active).toBe(true);
    });
  });

  describe("useGovernancePolicies", () => {
    it("fetches list of policies", async () => {
      mockClient.listPolicies.mockResolvedValue([
        { name: "zone_policy", enabled: true },
        { name: "action_filter", enabled: false },
      ]);
      const { result } = renderHook(() => useGovernancePolicies(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(2);
    });
  });

  describe("useAvailablePolicies", () => {
    it("fetches available policies", async () => {
      mockClient.listAvailablePolicies.mockResolvedValue([{ name: "pii_filter" }]);
      const { result } = renderHook(() => useAvailablePolicies(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useGovernancePresets", () => {
    it("fetches preset names", async () => {
      mockClient.listPresets.mockResolvedValue(["robotics-safe", "desktop-default"]);
      const { result } = renderHook(() => useGovernancePresets(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(["robotics-safe", "desktop-default"]);
    });
  });

  describe("useGovernanceConfig", () => {
    it("fetches YAML config", async () => {
      mockClient.getConfig.mockResolvedValue({ yaml: "version: 1.0\npolicies: []" });
      const { result } = renderHook(() => useGovernanceConfig(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.yaml).toContain("version");
    });
  });

  describe("useGovernanceAudit", () => {
    it("fetches audit entries with default limit", async () => {
      mockClient.getAudit.mockResolvedValue([{ policy_name: "zone_policy", decision: "allow" }]);
      const { result } = renderHook(() => useGovernanceAudit(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.getAudit).toHaveBeenCalledWith(50);
    });

    it("fetches audit entries with custom limit", async () => {
      mockClient.getAudit.mockResolvedValue([]);
      const { result } = renderHook(() => useGovernanceAudit(10), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.getAudit).toHaveBeenCalledWith(10);
    });
  });

  describe("useGovernanceViolations", () => {
    it("fetches violations", async () => {
      mockClient.getViolations.mockResolvedValue([
        { policy_name: "zone_policy", decision: "deny", severity: "critical" },
      ]);
      const { result } = renderHook(() => useGovernanceViolations(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useEnablePolicy", () => {
    it("calls client.enablePolicy", async () => {
      mockClient.enablePolicy.mockResolvedValue({ status: "enabled", name: "zone_policy" });
      const { result } = renderHook(() => useEnablePolicy(), { wrapper: createWrapper() });
      result.current.mutate("zone_policy");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.enablePolicy).toHaveBeenCalledWith("zone_policy");
    });
  });

  describe("useDisablePolicy", () => {
    it("calls client.disablePolicy", async () => {
      mockClient.disablePolicy.mockResolvedValue({ status: "disabled", name: "zone_policy" });
      const { result } = renderHook(() => useDisablePolicy(), { wrapper: createWrapper() });
      result.current.mutate("zone_policy");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.disablePolicy).toHaveBeenCalledWith("zone_policy");
    });
  });

  describe("useLoadPreset", () => {
    it("calls client.loadPreset", async () => {
      mockClient.loadPreset.mockResolvedValue({ status: "loaded", preset: "robotics-safe" });
      const { result } = renderHook(() => useLoadPreset(), { wrapper: createWrapper() });
      result.current.mutate("robotics-safe");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.loadPreset).toHaveBeenCalledWith("robotics-safe");
    });
  });

  describe("useUpdateGovernanceConfig", () => {
    it("sends YAML config", async () => {
      mockClient.updateConfig.mockResolvedValue({ status: "updated" });
      const { result } = renderHook(() => useUpdateGovernanceConfig(), { wrapper: createWrapper() });
      result.current.mutate("version: 2.0\npolicies: []");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.updateConfig).toHaveBeenCalledWith("version: 2.0\npolicies: []");
    });
  });

  describe("when disconnected", () => {
    it("queries are disabled when not connected", async () => {
      const { useOpenEyeConnection } = await import("@/hooks/useOpenEyeConnection");
      (useOpenEyeConnection as any).mockReturnValue({
        serverUrl: "",
        isConnected: false,
      });

      const { result } = renderHook(() => useGovernanceStatus(), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockClient.getStatus).not.toHaveBeenCalled();

      // Restore
      (useOpenEyeConnection as any).mockReturnValue({
        serverUrl: "http://localhost:8000",
        isConnected: true,
      });
    });
  });
});

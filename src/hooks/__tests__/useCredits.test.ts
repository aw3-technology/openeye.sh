import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mock dependencies ───────────────────────────────────────────

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" } })),
}));

vi.mock("@/lib/deployment-env", () => ({
  isCredSystemConfigured: () => true,
}));

vi.mock("@/lib/utils", () => ({
  toastMutationError: vi.fn(),
}));

const mockCredApi = {
  getBalance: vi.fn(),
  deduct: vi.fn(),
  issue: vi.fn(),
  createCheckout: vi.fn(),
  getPricingTiers: vi.fn(),
  getTransactions: vi.fn(),
  syncUser: vi.fn(),
};

vi.mock("@/lib/cred-api", () => ({
  credApi: mockCredApi,
}));

import {
  useCreditBalance,
  useDeductCredits,
  useIssueCredits,
  useCreateCheckout,
  usePricingTiers,
  useCreditTransactions,
  useSyncCredUser,
} from "@/hooks/useCredits";

// ── Test wrapper ────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

// ── Tests ───────────────────────────────────────────────────────

describe("useCredits hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useCreditBalance", () => {
    it("fetches credit balance on mount", async () => {
      mockCredApi.getBalance.mockResolvedValue({ balance: 500 });
      const { result } = renderHook(() => useCreditBalance(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ balance: 500 });
      expect(mockCredApi.getBalance).toHaveBeenCalledOnce();
    });

    it("does not fetch when user is null", async () => {
      const { useAuth } = await import("@/hooks/useAuth");
      (useAuth as any).mockReturnValue({ user: null });

      const { result } = renderHook(() => useCreditBalance(), { wrapper: createWrapper() });
      // Should stay in idle/loading state, never fetching
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockCredApi.getBalance).not.toHaveBeenCalled();

      // Restore
      (useAuth as any).mockReturnValue({ user: { id: "test-user" } });
    });
  });

  describe("useDeductCredits", () => {
    it("calls credApi.deduct with amount and description", async () => {
      mockCredApi.deduct.mockResolvedValue({ new_balance: 90 });
      const { result } = renderHook(() => useDeductCredits(), { wrapper: createWrapper() });

      result.current.mutate({ amount: 10, description: "inference" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.deduct).toHaveBeenCalledWith(10, "inference");
    });
  });

  describe("useIssueCredits", () => {
    it("calls credApi.issue with amount and description", async () => {
      mockCredApi.issue.mockResolvedValue({ new_balance: 200 });
      const { result } = renderHook(() => useIssueCredits(), { wrapper: createWrapper() });

      result.current.mutate({ amount: 100, description: "top-up" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.issue).toHaveBeenCalledWith(100, "top-up");
    });
  });

  describe("useCreateCheckout", () => {
    it("calls credApi.createCheckout with tier and URLs", async () => {
      mockCredApi.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/123" });
      const { result } = renderHook(() => useCreateCheckout(), { wrapper: createWrapper() });

      result.current.mutate({
        tierId: "tier-1",
        successUrl: "https://ok.com",
        cancelUrl: "https://cancel.com",
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.createCheckout).toHaveBeenCalledWith(
        "tier-1",
        "https://ok.com",
        "https://cancel.com",
      );
    });
  });

  describe("usePricingTiers", () => {
    it("fetches pricing tiers", async () => {
      mockCredApi.getPricingTiers.mockResolvedValue([{ id: "t1", name: "Basic", credits: 100 }]);
      const { result } = renderHook(() => usePricingTiers(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useCreditTransactions", () => {
    it("fetches transactions with default pagination", async () => {
      mockCredApi.getTransactions.mockResolvedValue({ data: [], count: 0 });
      const { result } = renderHook(() => useCreditTransactions(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.getTransactions).toHaveBeenCalledWith(0, 20);
    });

    it("fetches transactions with custom pagination", async () => {
      mockCredApi.getTransactions.mockResolvedValue({ data: [], count: 0 });
      const { result } = renderHook(() => useCreditTransactions(2, 10), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.getTransactions).toHaveBeenCalledWith(2, 10);
    });
  });

  describe("useSyncCredUser", () => {
    it("calls credApi.syncUser", async () => {
      mockCredApi.syncUser.mockResolvedValue({ user: { id: "u1" }, created: true });
      const { result } = renderHook(() => useSyncCredUser(), { wrapper: createWrapper() });

      result.current.mutate();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCredApi.syncUser).toHaveBeenCalledOnce();
    });
  });
});

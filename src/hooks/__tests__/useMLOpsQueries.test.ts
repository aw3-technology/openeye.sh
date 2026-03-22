import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import {
  useModels,
  usePromotions,
  useABTests,
  useRetrainingRuns,
  useBatchJobs,
  useShadowDeployments,
  useAnnotations,
  useValidationRuns,
  useExports,
  useLineage,
  useFeedbackBatches,
  stageBadgeVariant,
} from "@/hooks/useMLOpsQueries";

// ── Mock useOpenEyeConnection ──────────────────────────────────

const mockConnection = {
  serverUrl: "http://localhost:8000",
  isConnected: true,
  setServerUrl: vi.fn(),
  client: {} as never,
  healthData: null,
  isCloudDeployment: false,
};

vi.mock("@/hooks/useOpenEyeConnection", () => ({
  useOpenEyeConnection: () => mockConnection,
}));

// ── Test wrapper ────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

// ── Tests ───────────────────────────────────────────────────────

describe("useMLOpsQueries", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockConnection.isConnected = true;
    mockConnection.serverUrl = "http://localhost:8000";
  });

  function mockFetch(data: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    });
  }

  function mockFetchError(status: number, statusText: string) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
      json: () => Promise.resolve({ error: statusText }),
    });
  }

  describe("stageBadgeVariant", () => {
    it("maps dev to outline", () => {
      expect(stageBadgeVariant.dev).toBe("outline");
    });
    it("maps staging to secondary", () => {
      expect(stageBadgeVariant.staging).toBe("secondary");
    });
    it("maps production to default", () => {
      expect(stageBadgeVariant.production).toBe("default");
    });
    it("maps archived to destructive", () => {
      expect(stageBadgeVariant.archived).toBe("destructive");
    });
  });

  describe("useModels", () => {
    it("fetches models from /mlops/models", async () => {
      mockFetch([{ id: "m1", name: "yolov8", stage: "production" }]);
      const { result } = renderHook(() => useModels(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].name).toBe("yolov8");
    });

    it("is disabled when not connected", () => {
      mockConnection.isConnected = false;
      const { result } = renderHook(() => useModels(), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("usePromotions", () => {
    it("fetches promotions", async () => {
      mockFetch([{ id: "p1", model_id: "m1", from_stage: "dev", to_stage: "staging" }]);
      const { result } = renderHook(() => usePromotions(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useABTests", () => {
    it("fetches A/B tests", async () => {
      mockFetch([{ id: "ab1", name: "yolo-v8-vs-v9" }]);
      const { result } = renderHook(() => useABTests(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useRetrainingRuns", () => {
    it("fetches retraining runs", async () => {
      mockFetch([{ id: "rt1", status: "running" }]);
      const { result } = renderHook(() => useRetrainingRuns(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useBatchJobs", () => {
    it("fetches batch inference jobs", async () => {
      mockFetch([{ id: "bj1", status: "completed" }]);
      const { result } = renderHook(() => useBatchJobs(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useShadowDeployments", () => {
    it("fetches shadow deployments", async () => {
      mockFetch([{ id: "sd1", primary_model: "yolov8" }]);
      const { result } = renderHook(() => useShadowDeployments(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useAnnotations", () => {
    it("fetches failure annotations", async () => {
      mockFetch([{ id: "ann1", failure_type: "false_positive" }]);
      const { result } = renderHook(() => useAnnotations(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useValidationRuns", () => {
    it("fetches validation test runs", async () => {
      mockFetch([{ id: "vr1", passed: true }]);
      const { result } = renderHook(() => useValidationRuns(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useExports", () => {
    it("fetches export results", async () => {
      mockFetch([{ id: "ex1", format: "onnx" }]);
      const { result } = renderHook(() => useExports(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useLineage", () => {
    it("fetches model lineage", async () => {
      mockFetch([{ model_id: "m1", parent_id: null }]);
      const { result } = renderHook(() => useLineage(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useFeedbackBatches", () => {
    it("fetches feedback batches", async () => {
      mockFetch([{ id: "fb1", count: 50 }]);
      const { result } = renderHook(() => useFeedbackBatches(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("error handling", () => {
    it("reports error when fetch fails", async () => {
      mockFetchError(500, "Internal Server Error");
      const { result } = renderHook(() => useModels(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

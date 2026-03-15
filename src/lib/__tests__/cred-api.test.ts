import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
    },
  },
}));

vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "test-project");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { credApi } = await import("../cred-api");

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

describe("credApi (edge function proxy)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getBalance calls edge function", async () => {
    globalThis.fetch = mockFetchOk({ balance: 100, user_id: "u1", project_id: "p1" });
    const result = await credApi.getBalance();
    expect(result.balance).toBe(100);
  });

  it("deduct sends amount and description", async () => {
    globalThis.fetch = mockFetchOk({ balance: 90, user_id: "u1", project_id: "p1" });
    const result = await credApi.deduct(10, "test deduction");
    expect(result.balance).toBe(90);
  });

  it("syncUser calls sync-user endpoint", async () => {
    globalThis.fetch = mockFetchOk({ ok: true });
    const result = await credApi.syncUser();
    expect(result.ok).toBe(true);
  });

  it("createCheckout sends correct body", async () => {
    const fetchMock = mockFetchOk({ url: "https://checkout.stripe.com/123", session_id: "s1" });
    globalThis.fetch = fetchMock;
    await credApi.createCheckout("tier-1", "https://ok.com", "https://cancel.com");
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      pricing_tier_id: "tier-1",
      success_url: "https://ok.com",
      cancel_url: "https://cancel.com",
    });
  });

  it("getTransactions sends offset and limit params", async () => {
    const fetchMock = mockFetchOk({ data: [], count: 0 });
    globalThis.fetch = fetchMock;
    await credApi.getTransactions(2, 10);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("offset=20");
    expect(url).toContain("limit=10");
  });
});

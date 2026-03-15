import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock import.meta.env before importing the module
vi.stubEnv("VITE_CRED_API_URL", "https://test.supabase.co/functions/v1/credits-api");
vi.stubEnv("VITE_CRED_API_KEY", "test-api-key");
vi.stubEnv("VITE_CRED_PROJECT_ID", "test-project");

const { credApi } = await import("../cred-api");

const TOKEN = "user-jwt-token";

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, body: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

describe("credApi", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getBalance sends correct headers and path", async () => {
    const fetchMock = mockFetchOk({ balance: 100 });
    globalThis.fetch = fetchMock;

    const result = await credApi.getBalance(TOKEN);

    expect(result).toEqual({ balance: 100 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/projects/test-project/balance");
    expect(opts.headers.Authorization).toBe("Bearer test-api-key");
    expect(opts.headers["x-user-token"]).toBe(TOKEN);
  });

  it("deduct sends POST with amount and description", async () => {
    const fetchMock = mockFetchOk({ balance: 90 });
    globalThis.fetch = fetchMock;

    await credApi.deduct(TOKEN, 10, "test deduction");

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ amount: 10, description: "test deduction" });
  });

  it("refund sends POST with amount and description", async () => {
    const fetchMock = mockFetchOk({ balance: 110 });
    globalThis.fetch = fetchMock;

    await credApi.refund(TOKEN, 10, "refund test");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/refund");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ amount: 10, description: "refund test" });
  });

  it("throws on HTTP error with status and body", async () => {
    globalThis.fetch = mockFetchError(402, "Insufficient credits");

    await expect(credApi.getBalance(TOKEN)).rejects.toThrow("cred.diy API error 402: Insufficient credits");
  });

  it("includes timeout signal on requests", async () => {
    const fetchMock = mockFetchOk({ balance: 100 });
    globalThis.fetch = fetchMock;

    await credApi.getBalance(TOKEN);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.signal).toBeDefined();
  });

  it("createCheckout sends correct body", async () => {
    const fetchMock = mockFetchOk({ url: "https://checkout.stripe.com/123" });
    globalThis.fetch = fetchMock;

    await credApi.createCheckout(TOKEN, "tier-1", "https://ok.com", "https://cancel.com");

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      tier_id: "tier-1",
      success_url: "https://ok.com",
      cancel_url: "https://cancel.com",
    });
  });

  it("getTransactions sends offset and limit params", async () => {
    const fetchMock = mockFetchOk({ data: [], count: 0 });
    globalThis.fetch = fetchMock;

    await credApi.getTransactions(TOKEN, 2, 10);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("offset=20");
    expect(url).toContain("limit=10");
  });
});

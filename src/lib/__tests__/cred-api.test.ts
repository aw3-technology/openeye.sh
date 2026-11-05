import { describe, it, expect, vi, afterEach } from "vitest";

const { credApi } = await import("../cred-api");

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

describe("credApi (/api/cred proxy)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getBalance calls the same-origin proxy", async () => {
    const fetchMock = mockFetchOk({ user_id: "u1", balances: [{ balance: 100 }] });
    globalThis.fetch = fetchMock;
    const result = await credApi.getBalance();
    expect(result.balances[0].balance).toBe(100);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cred/balance");
    expect(opts.headers).not.toHaveProperty("Authorization");
  });


  it("syncUser calls users endpoint", async () => {
    globalThis.fetch = mockFetchOk({ user: { id: "u1" }, created: true });
    const result = await credApi.syncUser();
    expect(result.created).toBe(true);
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

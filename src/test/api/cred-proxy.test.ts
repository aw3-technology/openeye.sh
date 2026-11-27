// @vitest-environment node
/**
 * api/cred.ts must only expose read/purchase routes and always use the
 * session's identity — never let the browser issue credits or read someone
 * else's balance.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("../../../api/_lib/session.js", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "me@example.com", name: "Me" })),
}));

const { default: handler } = await import("../../../api/cred.ts");
const { requireUser } = await import("../../../api/_lib/session.js");

function call(method: string, url: string, body?: unknown) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []) as unknown as import("node:http").IncomingMessage;
  Object.assign(req, { method, url, headers: { "content-type": "application/json" } });
  const res = {
    statusCode: 200,
    body: "",
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    end(chunk?: string) {
      this.body = chunk ?? "";
    },
  };
  return handler(req, res as unknown as import("node:http").ServerResponse).then(() => res);
}

describe("cred proxy", () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));

  beforeEach(() => {
    process.env.CRED_API_KEY = "server-key";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("refuses to issue credits", async () => {
    const res = await call("POST", "/api/cred/issue", { amount: 1_000_000 });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses browser-side deductions", async () => {
    const res = await call("POST", "/api/cred/deduct", { amount: 1 });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses unknown and wrong-method routes", async () => {
    expect((await call("GET", "/api/cred/admin/users")).statusCode).toBe(404);
    expect((await call("POST", "/api/cred/balance")).statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the session email for balance, ignoring a spoofed one", async () => {
    await call("GET", "/api/cred/balance?email=victim@example.com&user_id=victim");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname.endsWith("/credits-api/balance")).toBe(true);
    expect(url.searchParams.get("email")).toBe("me@example.com");
    expect(url.searchParams.has("user_id")).toBe(false);
  });

  it("scopes transactions to the signed-in user", async () => {
    await call("GET", "/api/cred/transactions?offset=0&limit=20");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("email")).toBe("me@example.com");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("forces identity into user sync", async () => {
    await call("POST", "/api/cred/users", { external_id: "someone-else", user_id: "someone-else" });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.external_id).toBe("user-1");
    expect(body.user_id).toBe("user-1");
    expect(body.email).toBe("me@example.com");
  });

  describe("with Electrum on (ELECTRUM_ENABLED) and a verified email", () => {
    const tiersReply = () => new Response(JSON.stringify({ pricing_tiers: [{ id: "tier-elec-5" }] }), { status: 200 });
    beforeEach(() => {
      process.env.ELECTRUM_ENABLED = "true";
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "Me@Example.com", name: "Me", emailVerified: true } as never);
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes("pricing-tiers?shared=true") ? tiersReply() : new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    });
    afterEach(() => {
      delete process.env.ELECTRUM_ENABLED;
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "me@example.com", name: "Me" } as never);
    });

    it("keeps OpenEye's own packs and lists the Electrum packs apart, on OpenEye's own key", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes("pricing-tiers?shared=true")
          ? tiersReply()
          : new Response(JSON.stringify({ pricing_tiers: [{ id: "legacy-tier" }] }), { status: 200 }),
      );
      const res = await call("GET", "/api/cred/pricing-tiers");
      expect(JSON.parse(res.body)).toEqual({ pricing_tiers: [{ id: "legacy-tier" }], electrum_tiers: [{ id: "tier-elec-5" }] });
      for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
        expect((init.headers as Record<string, string>)["x-api-key"]).toBe("server-key");
      }
    });

    it("checks out an Electrum pack with shared: true and the trusted email", async () => {
      await call("POST", "/api/cred/checkout", { pricing_tier_id: "tier-elec-5" });
      const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("hosted-checkout")) as [string, RequestInit];
      expect(url).toMatch(/\/hosted-checkout$/);
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("server-key");
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ shared: true, pricing_tier_id: "tier-elec-5", user_email: "me@example.com" });
    });

    it("keeps an OpenEye pack's checkout as it was", async () => {
      await call("POST", "/api/cred/checkout", { pricing_tier_id: "legacy-tier" });
      const [, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("hosted-checkout")) as [string, RequestInit];
      expect(JSON.parse(String(init.body)).shared).toBeUndefined();
    });

    it("reads the balance with include_shared", async () => {
      await call("GET", "/api/cred/balance");
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("include_shared=true");
    });

    it("grants the 1 Electrum welcome on user sync", async () => {
      await call("POST", "/api/cred/users", {});
      const w = fetchMock.mock.calls.find(([u]) => String(u).includes("/issue"))!;
      expect((w[1]?.headers as Record<string, string>)["Idempotency-Key"]).toBe("aw3-welcome:me@example.com");
      expect(JSON.parse(String(w[1]?.body))).toEqual({ shared: true, user_email: "me@example.com", amount: 1, reason: "Electrum welcome credit" });
    });
  });
});

// @vitest-environment node
/**
 * Electrum v2 (cred.diy shared_fallback): one /deduct call on OpenEye's own key,
 * `paid_from` recorded, Electrum-paid refunds by transaction id with
 * `shared: true`, the welcome's key and body exact. (OpenEye has no
 * "can afford?" gate or escrow holds, so no shared_rate conversion.) Mirrors backend/tests/test_credits_service.py::TestElectrum.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deduct, getBalances, refund } from "../../../api/_lib/credits.ts";
import { electrumWelcome } from "../../../api/_lib/electrum.ts";

const user = { id: "user-1", email: " Ada@Example.com ", emailVerified: true };

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeCred(deductReply: { status: number; body: Record<string, unknown> }[] = [{ status: 200, body: { success: true, paid_from: "app", transaction_id: "tx-app" } }]) {
  const calls: Call[] = [];
  const replies = [...deductReply];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : {} });
      const u = String(url);
      if (u.includes("/deduct")) {
        const r = replies.length > 1 ? replies.shift()! : replies[0];
        return new Response(JSON.stringify(r.body), { status: r.status });
      }
      if (u.includes("/balance")) {
        return new Response(JSON.stringify({ balances: [{ credit_type_id: "ct", balance: 2 }], shared_balance: { balance: 3.4 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }),
  );
  return { calls, deducts: () => calls.filter((c) => c.url.includes("/deduct")) };
}

describe("Electrum v2", () => {
  beforeEach(() => {
    process.env.CRED_API_KEY = "app-key";
    process.env.CRED_CREDIT_TYPE_ID = "ct";
    process.env.ELECTRUM_ENABLED = "true";
    delete process.env.OPENEYE_CREDITS_DISABLED;
  });
  afterEach(() => {
    delete process.env.ELECTRUM_ENABLED;
    delete process.env.CRED_CREDIT_TYPE_ID;
    vi.unstubAllGlobals();
  });

  it("one /deduct with shared_fallback and the trusted email; OpenEye paid", async () => {
    const cred = fakeCred();
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toEqual({ source: "app", transactionId: "tx-app" });
    expect(cred.deducts()).toHaveLength(1);
    const [call] = cred.deducts();
    expect(call.headers["x-api-key"]).toBe("app-key");
    expect(call.body).toMatchObject({ shared_fallback: true, user_email: "ada@example.com", credit_type_id: "ct", amount: 3 });
  });

  it("paid_from shared is recorded, and its refund goes by transaction id with shared: true", async () => {
    const cred = fakeCred([{ status: 200, body: { success: true, paid_from: "shared", transaction_id: "tx-elec", amount_deducted: 0.03 } }]);
    const charge = await deduct(user, 3, "OpenEye API /v1/detect");
    expect(charge).toEqual({ source: "shared", transactionId: "tx-elec" });
    await refund(user, 3, "Refund: /v1/detect failed", charge as Exclude<typeof charge, false>);
    const r = cred.calls.find((c) => c.url.includes("/refund"))!;
    expect(r.body).toMatchObject({ transaction_id: "tx-elec", shared: true });
    expect(r.body.amount).toBeUndefined();
    expect(cred.calls.some((c) => c.url.includes("/issue"))).toBe(false);
  });

  it("an OpenEye-paid refund is today's /issue", async () => {
    const cred = fakeCred();
    await refund(user, 3, "Refund", { source: "app", transactionId: "tx-app" });
    expect(cred.calls.some((c) => c.url.includes("/issue"))).toBe(true);
    expect(cred.calls.some((c) => c.url.includes("/refund"))).toBe(false);
  });

  it("both short: refused (402 path), one call only", async () => {
    const cred = fakeCred([{ status: 400, body: { code: "INSUFFICIENT_CREDITS" } }]);
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toBe(false);
    expect(cred.deducts()).toHaveLength(1);
  });

  it("hub not linked: the same call once more without the fallback", async () => {
    const cred = fakeCred([
      { status: 400, body: { code: "SHARED_NOT_LINKED" } },
      { status: 200, body: { success: true, transaction_id: "tx-app" } },
    ]);
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toEqual({ source: "app", transactionId: "tx-app" });
    const [first, second] = cred.deducts();
    expect(first.body.shared_fallback).toBe(true);
    expect(second.body.shared_fallback).toBeUndefined();
  });

  it("off: no shared fields are sent anywhere", async () => {
    delete process.env.ELECTRUM_ENABLED;
    const cred = fakeCred();
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toEqual({ source: "app", transactionId: "tx-app" });
    expect(cred.deducts()[0].body.shared_fallback).toBeUndefined();
    expect((await getBalances(user)).electrum).toBeNull();
    expect(cred.calls.some((c) => c.url.includes("include_shared"))).toBe(false);
  });

  it("unverified email: no shared fallback", async () => {
    const cred = fakeCred();
    await deduct({ ...user, emailVerified: false }, 3, "OpenEye API /v1/detect");
    expect(cred.deducts()[0].body.shared_fallback).toBeUndefined();
  });

  it("balance asks for include_shared and keeps Electrum apart", async () => {
    const cred = fakeCred();
    expect(await getBalances(user)).toEqual({ app: 2, electrum: 3.4 });
    expect(cred.calls[0].url).toContain("include_shared=true");
    expect(cred.calls[0].url).toContain("email=ada%40example.com");
  });

  it("welcome: exact key and body on OpenEye's own key", async () => {
    const cred = fakeCred();
    expect(await electrumWelcome("ada@example.com")).toBe(true);
    const w = cred.calls.find((c) => c.url.includes("/issue"))!;
    expect(w.headers["Idempotency-Key"]).toBe("aw3-welcome:ada@example.com");
    expect(w.headers["x-api-key"]).toBe("app-key");
    expect(w.body).toEqual({ shared: true, user_email: "ada@example.com", amount: 1, reason: "Electrum welcome credit" });
  });
});

// @vitest-environment node
/**
 * Electrum (the shared AW3 Credit): legacy first, never split; refunds go to
 * the source that paid; the welcome grant's key and body are exact.
 * Mirrors backend/tests/test_credits_service.py::TestAw3Chooser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deduct, getBalance, refund } from "../../../api/_lib/credits.ts";
import { aw3Welcome } from "../../../api/_lib/aw3-credit.ts";

const HUB_KEY = "hub-key";
const user = { id: "user-1", email: " Ada@Example.com ", emailVerified: true };

type Call = { url: string; init: RequestInit; headers: Record<string, string>; body: Record<string, unknown> };

function fakeCred(legacyStatus: number, hubStatus = 200) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ url: String(url), init, headers, body: init.body ? JSON.parse(String(init.body)) : {} });
    const isHub = headers["x-api-key"] === HUB_KEY;
    if (String(url).includes("/balance")) {
      const balances = isHub ? [{ credit_type_id: "ct-aw3", balance: 7 }] : [{ credit_type_id: "x", balance: 2 }];
      return new Response(JSON.stringify({ balances }), { status: 200 });
    }
    const status = isHub ? hubStatus : legacyStatus;
    return new Response(JSON.stringify({ success: status === 200 }), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, hub: () => calls.filter((c) => c.headers["x-api-key"] === HUB_KEY) };
}

function aw3On() {
  process.env.AW3_CRED_API_KEY = HUB_KEY;
  process.env.AW3_CRED_CREDIT_TYPE_ID = "ct-aw3";
  process.env.AW3_CRED_PRICING_TIER_ID = "tier-aw3";
}

describe("Electrum chooser", () => {
  beforeEach(() => {
    process.env.CRED_API_KEY = "app-key";
    delete process.env.CRED_CREDIT_TYPE_ID;
    delete process.env.OPENEYE_CREDITS_DISABLED;
  });
  afterEach(() => {
    delete process.env.AW3_CRED_API_KEY;
    delete process.env.AW3_CRED_CREDIT_TYPE_ID;
    delete process.env.AW3_CRED_PRICING_TIER_ID;
    vi.unstubAllGlobals();
  });

  it("legacy enough: charges OpenEye's own credits only", async () => {
    aw3On();
    const cred = fakeCred(200);
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toBe("app");
    expect(cred.hub()).toHaveLength(0);
  });

  it("legacy short: charges all of it to Electrum on the hub", async () => {
    aw3On();
    const cred = fakeCred(402);
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toBe("aw3");
    const [call] = cred.hub();
    expect(call.url).toMatch(/\/credits-api\/deduct$/);
    expect(call.headers["Idempotency-Key"]).toMatch(/^openeye:deduct:/);
    expect(call.headers["x-app-origin"]).toBe("https://openeye.sh");
    expect(call.body).toEqual({
      user_id: "ada@example.com",
      user_email: "ada@example.com",
      credit_type_id: "ct-aw3",
      amount: 3,
      reason: "OpenEye: API /v1/detect",
    });
  });

  it("both short: refused", async () => {
    aw3On();
    fakeCred(402, 402);
    expect(await deduct(user, 3, "OpenEye API /v1/detect")).toBe(false);
  });

  it("hub down: falls back to the legacy-only refusal", async () => {
    aw3On();
    fakeCred(402, 503);
    expect(await deduct(user, 3, "x")).toBe(false);
  });

  it("Electrum off (partial config): today's behaviour, hub never called", async () => {
    process.env.AW3_CRED_API_KEY = HUB_KEY;
    const cred = fakeCred(402);
    expect(await deduct(user, 3, "x")).toBe(false);
    expect(await getBalance(user)).toBe(2);
    expect(cred.hub()).toHaveLength(0);
  });

  it("unverified email: legacy only", async () => {
    aw3On();
    const cred = fakeCred(402);
    expect(await deduct({ ...user, emailVerified: false }, 3, "x")).toBe(false);
    expect(cred.hub()).toHaveLength(0);
  });

  it("refund goes to the recorded source", async () => {
    aw3On();
    const cred = fakeCred(200);
    await refund(user, 3, "Refund: /v1/detect failed", "aw3");
    expect(cred.hub()).toHaveLength(1);
    expect(cred.hub()[0].url).toMatch(/\/credits-api\/issue$/);
    expect(cred.hub()[0].body.reason).toBe("OpenEye: Refund: /v1/detect failed");
    await refund(user, 3, "Refund", "app");
    expect(cred.calls).toHaveLength(2);
    expect(cred.calls[1].headers["x-api-key"]).toBe("app-key");
  });

  it("balance is legacy + Electrum", async () => {
    aw3On();
    fakeCred(200);
    expect(await getBalance(user)).toBe(9);
  });

  it("welcome: exact key and body", async () => {
    aw3On();
    const cred = fakeCred(200, 200);
    expect(await aw3Welcome("ada@example.com")).toBe(true);
    const [call] = cred.hub();
    expect(call.headers["Idempotency-Key"]).toBe("aw3-welcome:ada@example.com");
    expect(call.body).toEqual({
      user_id: "ada@example.com",
      user_email: "ada@example.com",
      credit_type_id: "ct-aw3",
      amount: 50,
      reason: "Electrum welcome credits",
    });
  });
});

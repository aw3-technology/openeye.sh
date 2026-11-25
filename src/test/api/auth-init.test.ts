// @vitest-environment node
/**
 * api/_lib/auth.ts must not touch the network or the database at import time:
 * Vercel can suspend a pre-warmed instance between module load and its first
 * request, and Better Auth's init (1Profile discovery, schema check) was cut
 * off mid-flight (2026-11-24..25 logs). getAuth() does that work on demand.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const betterAuth = vi.fn((options: unknown) => ({ options, $context: Promise.resolve({}), api: {} }));
vi.mock("better-auth", () => ({ betterAuth }));
vi.mock("better-auth/plugins", () => ({ genericOAuth: vi.fn(() => ({ id: "generic-oauth" })) }));
vi.mock("../../../api/_lib/db.js", () => ({ pool: {} }));
const fetchMock = vi.fn(async () => new Response("{}"));
vi.stubGlobal("fetch", fetchMock);

describe("getAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    betterAuth.mockClear();
    fetchMock.mockClear();
  });

  it("does nothing at import, then initializes once", async () => {
    const mod = await import("../../../api/_lib/auth.ts");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(betterAuth).not.toHaveBeenCalled();

    const [a, b] = await Promise.all([mod.getAuth(), mod.getAuth()]);
    expect(a).toBe(b);
    expect(betterAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // discovery warm-up
  });

  it.each([
    ["production", false],
    ["preview", true],
  ])("VERCEL_ENV=%s sets validateSchema=%s", async (env, expected) => {
    vi.stubEnv("VERCEL_ENV", env);
    await (await import("../../../api/_lib/auth.ts")).getAuth();
    vi.unstubAllEnvs();
    const [options] = betterAuth.mock.calls[0] as [{ advanced: { database: { validateSchema: boolean } } }];
    expect(options.advanced.database.validateSchema).toBe(expected);
  });
});

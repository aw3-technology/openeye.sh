import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: () => getSession() },
}));

import {
  FLEET_SIGN_IN_MESSAGE,
  LocalFleetClient,
  getBetterAuthSessionToken,
} from "../fleet-client-local";
import { AuthenticationError } from "../base-api-client";

function okJson(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

describe("LocalFleetClient auth", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okJson([]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    getSession.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function headersOf(call: number) {
    return fetchMock.mock.calls[call][1].headers as Record<string, string>;
  }

  it("sends the Better Auth session token as a Bearer header", async () => {
    getSession.mockResolvedValue({
      data: { session: { token: "tok_abc", userId: "u1", expiresAt: "" }, user: { id: "u1" } },
      error: null,
    });
    const client = new LocalFleetClient("http://fleet.test");

    await client.listDevices();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://fleet.test/devices");
    expect(headersOf(0).Authorization).toBe("Bearer tok_abc");
  });

  it("keeps caller headers alongside Authorization on writes", async () => {
    const client = new LocalFleetClient("http://fleet.test", async () => "tok_xyz");

    await client.createGroup({ name: "A" } as never);

    const headers = headersOf(0);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer tok_xyz");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("attaches the header on every request", async () => {
    const client = new LocalFleetClient("http://fleet.test", async () => "tok_1");

    await client.listDevices();
    await client.listAlerts();
    await client.restartDevice("dev-1");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) expect(headersOf(i).Authorization).toBe("Bearer tok_1");
  });

  it("without a session (demo user) sends nothing and asks the user to sign in", async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    const client = new LocalFleetClient("http://fleet.test");

    const err = await client.listDevices().catch((e) => e);

    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe(FLEET_SIGN_IN_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a failing session lookup as signed out", async () => {
    getSession.mockRejectedValue(new Error("network down"));
    await expect(getBetterAuthSessionToken()).resolves.toBeNull();
  });
});

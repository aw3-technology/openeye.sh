import { describe, it, expect, vi } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" }, access_token: "test-token" } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "dev-1", name: "test", user_id: "test-user", status: "online", created_at: new Date().toISOString() },
        error: null,
      }),
    })),
  },
}));

import * as fleet from "../fleet-client";

describe("fleet-client (Supabase)", () => {
  it("getDevice returns a mapped device", async () => {
    const device = await fleet.getDevice("dev-1");
    expect(device.id).toBe("dev-1");
    expect(device.status).toBe("online");
  });
});

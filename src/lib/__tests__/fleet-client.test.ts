import { describe, it, expect, vi, beforeEach } from "vitest";

// Force cloud mode so the Supabase mock is used
vi.mock("@/lib/deployment-env", () => ({
  isCloudDeployment: () => true,
}));

// ── Mock data ───────────────────────────────────────────────────

const now = new Date().toISOString();

const fakeDevice = {
  id: "dev-1",
  user_id: "test-user",
  name: "cam-front",
  device_type: "camera",
  status: "online",
  hardware_specs: {},
  tags: { zone: "loading" },
  config_overrides: {},
  firmware_version: "1.0",
  current_model_id: null,
  current_model_version: null,
  ip_address: "10.0.0.1",
  last_heartbeat_at: now,
  registered_at: now,
  created_at: now,
  updated_at: now,
};

const fakeDeployment = {
  id: "dep-1",
  user_id: "test-user",
  name: "yolov8-canary",
  model_id: "yolov8",
  model_version: "2.1",
  strategy: "canary",
  status: "pending",
  rollout_stages: [],
  current_stage: 0,
  target_device_ids: [],
  target_group_id: null,
  created_at: now,
  updated_at: now,
};

const fakeGroup = {
  id: "grp-1",
  user_id: "test-user",
  name: "Warehouse A",
  description: "",
  tag_filter: {},
  auto_scaling_policy: null,
  created_at: now,
  updated_at: now,
};

const fakeAlert = {
  id: "alert-1",
  user_id: "test-user",
  device_id: "dev-1",
  deployment_id: null,
  alert_type: "device_offline",
  severity: "warning",
  title: "Device offline",
  message: "No heartbeat",
  resolved: false,
  resolved_at: null,
  created_at: now,
};

const fakeMaintenance = {
  id: "maint-1",
  user_id: "test-user",
  name: "Nightly",
  description: "",
  device_ids: [],
  group_id: null,
  starts_at: now,
  ends_at: now,
  recurrence: null,
  is_active: true,
  created_at: now,
  updated_at: now,
};

// ── Supabase mock builder ───────────────────────────────────────

let mockSingleResult: { data: any; error: any } = { data: fakeDevice, error: null };
let mockListResult: { data: any; error: any } = { data: [fakeDevice], error: null };

const chainMock = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockImplementation(function (this: any) {
    // Resolve with the list result when order() is the terminal call
    Object.assign(this, { then: (fn: any) => Promise.resolve(mockListResult).then(fn) });
    return this;
  }),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(() => Promise.resolve(mockSingleResult)),
  then: undefined as any,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" }, access_token: "test-token" } },
      }),
    },
    from: vi.fn(() => {
      const mock = chainMock();
      // Make the chain itself thenable for list queries (select -> order -> await)
      (mock as any).then = (resolve: any, reject: any) => Promise.resolve(mockListResult).then(resolve, reject);
      return mock;
    }),
  },
}));

import * as fleet from "../fleet-client";

// ── Tests ───────────────────────────────────────────────────────

describe("fleet-client (Supabase) — Stories 51-65", () => {
  beforeEach(() => {
    mockSingleResult = { data: fakeDevice, error: null };
    mockListResult = { data: [fakeDevice], error: null };
  });

  // ── Devices (Stories 51-55, 61-62) ────────────────────────────

  describe("registerDevice", () => {
    it("returns id and maps response", async () => {
      mockSingleResult = { data: { ...fakeDevice, api_key: "oek_abc" }, error: null };
      const device = await fleet.registerDevice({ name: "cam-1", device_type: "camera" as any });
      expect(device.id).toBe("dev-1");
    });
  });

  describe("listDevices", () => {
    it("returns array of devices with status filter", async () => {
      mockListResult = { data: [fakeDevice], error: null };
      const devices = await fleet.listDevices({ status: "online" });
      expect(Array.isArray(devices)).toBe(true);
      expect(devices[0].id).toBe("dev-1");
    });
  });

  describe("getDevice", () => {
    it("returns a mapped device", async () => {
      const device = await fleet.getDevice("dev-1");
      expect(device.id).toBe("dev-1");
      expect(device.status).toBe("online");
      expect(device.name).toBe("cam-front");
    });
  });

  describe("setTags", () => {
    it("sends tag key=value pairs", async () => {
      mockSingleResult = { data: { ...fakeDevice, tags: { zone: "dock" } }, error: null };
      const device = await fleet.setTags("dev-1", { zone: "dock" });
      expect(device.id).toBe("dev-1");
    });
  });

  // ── Groups (Stories 56-57) ────────────────────────────────────

  describe("createGroup", () => {
    it("creates a group and returns response", async () => {
      mockSingleResult = { data: fakeGroup, error: null };
      const group = await fleet.createGroup({ name: "Warehouse A", description: "" });
      expect(group.id).toBe("grp-1");
      expect(group.name).toBe("Warehouse A");
    });
  });

  describe("addGroupMember", () => {
    it("does not throw", async () => {
      mockListResult = { data: null, error: null };
      await expect(fleet.addGroupMember("grp-1", "dev-1")).resolves.not.toThrow();
    });
  });

  // ── Deployments (Stories 58-60) ───────────────────────────────

  describe("createDeployment", () => {
    it("creates a deployment with strategy", async () => {
      mockSingleResult = { data: fakeDeployment, error: null };
      const dep = await fleet.createDeployment({
        name: "yolov8-canary",
        model_id: "yolov8",
        model_version: "2.1",
        strategy: "canary" as any,
      });
      expect(dep.id).toBe("dep-1");
      expect(dep.strategy).toBe("canary");
    });
  });

  describe("rollbackDeployment", () => {
    it("updates deployment status to rolling_back", async () => {
      mockSingleResult = { data: { ...fakeDeployment, status: "rolling_back" }, error: null };
      const dep = await fleet.rollbackDeployment("dep-1");
      expect(dep.status).toBe("rolling_back");
    });
  });

  // ── Alerts (Stories 63-64) ────────────────────────────────────

  describe("listAlerts", () => {
    it("returns alerts array", async () => {
      mockListResult = { data: [fakeAlert], error: null };
      const alerts = await fleet.listAlerts(false);
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts[0].severity).toBe("warning");
    });
  });

  describe("resolveAlert", () => {
    it("resolves an alert", async () => {
      mockSingleResult = { data: { ...fakeAlert, resolved: true, resolved_at: now }, error: null };
      const alert = await fleet.resolveAlert("alert-1");
      expect(alert.resolved).toBe(true);
    });
  });

  // ── Maintenance (Story 65) ────────────────────────────────────

  describe("createMaintenanceWindow", () => {
    it("creates a maintenance window", async () => {
      mockSingleResult = { data: fakeMaintenance, error: null };
      const win = await fleet.createMaintenanceWindow({
        name: "Nightly",
        starts_at: now,
        ends_at: now,
      });
      expect(win.id).toBe("maint-1");
      expect(win.name).toBe("Nightly");
    });
  });

  describe("updateMaintenanceWindow", () => {
    it("updates a maintenance window", async () => {
      mockSingleResult = { data: { ...fakeMaintenance, name: "Updated" }, error: null };
      const win = await fleet.updateMaintenanceWindow("maint-1", { name: "Updated" });
      expect(win.name).toBe("Updated");
    });
  });

  // ── Restart & Decommission (Stories 61-62) ────────────────────

  describe("restartDevice", () => {
    it("returns command_id", async () => {
      const result = await fleet.restartDevice("dev-1");
      expect(result.command_id).toBeDefined();
    });
  });

  describe("decommissionDevice", () => {
    it("decommissions with wipe", async () => {
      mockSingleResult = { data: { ...fakeDevice, status: "decommissioned" }, error: null };
      const device = await fleet.decommissionDevice("dev-1", { reason: "EOL", wipe_data: true });
      expect(device.status).toBe("decommissioned");
    });
  });
});

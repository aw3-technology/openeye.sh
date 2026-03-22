import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock data ───────────────────────────────────────────────────

const now = new Date().toISOString();

const fakeDeviceRow = {
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
  last_seen_at: now,
  registered_at: now,
  created_at: now,
  updated_at: now,
};

const fakeDeploymentRow = {
  id: "dep-1",
  user_id: "test-user",
  name: "yolov8-canary",
  model_id: "yolov8",
  model_version: "2.1",
  model_url: null,
  model_checksum: null,
  strategy: "canary",
  status: "pending",
  rollout_stages: [],
  current_stage: 0,
  target_device_ids: [],
  target_group_id: null,
  bandwidth_limit_mbps: null,
  rollback_version: null,
  started_at: null,
  completed_at: null,
  created_at: now,
  updated_at: now,
};

const fakeGroupRow = {
  id: "grp-1",
  user_id: "test-user",
  name: "Warehouse A",
  description: "",
  tag_filter: {},
  auto_scaling_policy: null,
  created_at: now,
  updated_at: now,
};

const fakeAlertRow = {
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

const fakeMaintenanceRow = {
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

let mockSingleResult: { data: any; error: any } = { data: fakeDeviceRow, error: null };
let mockListResult: { data: any; error: any } = { data: [fakeDeviceRow], error: null };
let mockCountResult: { count: number } = { count: 3 };

const chainMock = () => {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(function (this: any) {
      Object.assign(this, { then: (fn: any) => Promise.resolve(mockListResult).then(fn) });
      return this;
    }),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(mockSingleResult)),
    then: undefined as any,
  };
  mock.then = (resolve: any, reject: any) => Promise.resolve(mockListResult).then(resolve, reject);
  return mock;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" }, access_token: "test-token" } },
      }),
    },
    from: vi.fn(() => {
      const mock = chainMock();
      // For count queries (head: true), return mock count
      const origSelect = mock.select;
      mock.select = vi.fn().mockImplementation((...args: any[]) => {
        if (args[1]?.head) {
          return { ...mock, then: (fn: any) => Promise.resolve(mockCountResult).then(fn) };
        }
        return origSelect(...args);
      });
      return mock;
    }),
  },
}));

import { CloudFleetClient } from "../fleet-client-cloud";

// ── Tests ───────────────────────────────────────────────────────

describe("CloudFleetClient (Supabase)", () => {
  let client: CloudFleetClient;

  beforeEach(() => {
    client = new CloudFleetClient();
    mockSingleResult = { data: fakeDeviceRow, error: null };
    mockListResult = { data: [fakeDeviceRow], error: null };
  });

  // ── Devices ────────────────────────────────────────────────────

  describe("registerDevice", () => {
    it("returns a mapped device response", async () => {
      mockSingleResult = { data: fakeDeviceRow, error: null };
      const device = await client.registerDevice({ name: "cam-1", device_type: "camera" as any });
      expect(device.id).toBe("dev-1");
      expect(device.name).toBe("cam-front");
    });

    it("throws on supabase error", async () => {
      mockSingleResult = { data: null, error: { message: "insert failed" } };
      await expect(client.registerDevice({ name: "cam-1" } as any)).rejects.toThrow("insert failed");
    });
  });

  describe("listDevices", () => {
    it("returns an array of mapped devices", async () => {
      mockListResult = { data: [fakeDeviceRow], error: null };
      const devices = await client.listDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices[0].id).toBe("dev-1");
      expect(devices[0].device_type).toBe("camera");
    });

    it("returns empty array when no devices", async () => {
      mockListResult = { data: [], error: null };
      const devices = await client.listDevices();
      expect(devices).toEqual([]);
    });

    it("filters by tag_key and tag_value", async () => {
      const devWithTag = { ...fakeDeviceRow, tags: { zone: "loading" } };
      const devWithoutTag = { ...fakeDeviceRow, id: "dev-2", tags: { zone: "office" } };
      mockListResult = { data: [devWithTag, devWithoutTag], error: null };
      const devices = await client.listDevices({ tag_key: "zone", tag_value: "loading" });
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe("dev-1");
    });
  });

  describe("getDevice", () => {
    it("returns a single mapped device", async () => {
      const device = await client.getDevice("dev-1");
      expect(device.id).toBe("dev-1");
      expect(device.status).toBe("online");
    });
  });

  describe("updateDevice", () => {
    it("returns updated device", async () => {
      mockSingleResult = { data: { ...fakeDeviceRow, name: "cam-rear" }, error: null };
      const device = await client.updateDevice("dev-1", { name: "cam-rear" });
      expect(device.name).toBe("cam-rear");
    });
  });

  describe("setTags", () => {
    it("updates tags and returns mapped device", async () => {
      mockSingleResult = { data: { ...fakeDeviceRow, tags: { area: "dock" } }, error: null };
      const device = await client.setTags("dev-1", { area: "dock" });
      expect(device.tags).toEqual({ area: "dock" });
    });
  });

  describe("restartDevice", () => {
    it("returns restart_queued status with command_id", async () => {
      const result = await client.restartDevice("dev-1");
      expect(result.status).toBe("restart_queued");
      expect(result.command_id).toBeDefined();
    });
  });

  describe("decommissionDevice", () => {
    it("sets device status to decommissioned", async () => {
      mockSingleResult = { data: { ...fakeDeviceRow, status: "decommissioned" }, error: null };
      const device = await client.decommissionDevice("dev-1");
      expect(device.status).toBe("decommissioned");
    });
  });

  // ── Deployments ────────────────────────────────────────────────

  describe("createDeployment", () => {
    it("creates and returns mapped deployment", async () => {
      mockSingleResult = { data: fakeDeploymentRow, error: null };
      const dep = await client.createDeployment({
        name: "yolov8-canary",
        model_id: "yolov8",
        model_version: "2.1",
        strategy: "canary" as any,
      });
      expect(dep.id).toBe("dep-1");
      expect(dep.strategy).toBe("canary");
    });
  });

  describe("listDeployments", () => {
    it("returns array of mapped deployments", async () => {
      mockListResult = { data: [fakeDeploymentRow], error: null };
      const deps = await client.listDeployments();
      expect(deps).toHaveLength(1);
      expect(deps[0].model_id).toBe("yolov8");
    });
  });

  describe("pauseDeployment", () => {
    it("sets deployment status to paused", async () => {
      mockSingleResult = { data: { ...fakeDeploymentRow, status: "paused" }, error: null };
      const dep = await client.pauseDeployment("dep-1");
      expect(dep.status).toBe("paused");
    });
  });

  describe("rollbackDeployment", () => {
    it("sets deployment status to rolling_back", async () => {
      mockSingleResult = { data: { ...fakeDeploymentRow, status: "rolling_back" }, error: null };
      const dep = await client.rollbackDeployment("dep-1");
      expect(dep.status).toBe("rolling_back");
    });
  });

  // ── Groups ────────────────────────────────────────────────────

  describe("createGroup", () => {
    it("creates and returns mapped group", async () => {
      mockSingleResult = { data: fakeGroupRow, error: null };
      const group = await client.createGroup({ name: "Warehouse A", description: "" });
      expect(group.id).toBe("grp-1");
      expect(group.name).toBe("Warehouse A");
    });
  });

  describe("deleteGroup", () => {
    it("does not throw on success", async () => {
      mockListResult = { data: null, error: null };
      await expect(client.deleteGroup("grp-1")).resolves.not.toThrow();
    });

    it("throws on supabase error", async () => {
      mockListResult = { data: null, error: { message: "foreign key violation" } };
      await expect(client.deleteGroup("grp-1")).rejects.toThrow("foreign key violation");
    });
  });

  // ── Maintenance ────────────────────────────────────────────────

  describe("createMaintenanceWindow", () => {
    it("creates and returns maintenance window", async () => {
      mockSingleResult = { data: fakeMaintenanceRow, error: null };
      const win = await client.createMaintenanceWindow({
        name: "Nightly",
        starts_at: now,
        ends_at: now,
      });
      expect(win.id).toBe("maint-1");
      expect(win.is_active).toBe(true);
    });
  });

  describe("updateMaintenanceWindow", () => {
    it("updates and returns maintenance window", async () => {
      mockSingleResult = { data: { ...fakeMaintenanceRow, name: "Weekly" }, error: null };
      const win = await client.updateMaintenanceWindow("maint-1", { name: "Weekly" });
      expect(win.name).toBe("Weekly");
    });
  });

  describe("deleteMaintenanceWindow", () => {
    it("does not throw on success", async () => {
      mockListResult = { data: null, error: null };
      await expect(client.deleteMaintenanceWindow("maint-1")).resolves.not.toThrow();
    });
  });

  // ── Alerts ────────────────────────────────────────────────────

  describe("listAlerts", () => {
    it("returns array of mapped alerts", async () => {
      mockListResult = { data: [fakeAlertRow], error: null };
      const alerts = await client.listAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].resolved).toBe(false);
    });
  });

  describe("resolveAlert", () => {
    it("sets resolved to true", async () => {
      mockSingleResult = { data: { ...fakeAlertRow, resolved: true, resolved_at: now }, error: null };
      const alert = await client.resolveAlert("alert-1");
      expect(alert.resolved).toBe(true);
      expect(alert.resolved_at).toBe(now);
    });
  });

  // ── OTA ────────────────────────────────────────────────────────

  describe("pushOTAUpdate", () => {
    it("returns queued status and command count", async () => {
      const result = await client.pushOTAUpdate({
        device_ids: ["dev-1", "dev-2"],
        firmware_version: "2.0",
      } as any);
      expect(result.status).toBe("ota_queued");
      expect(result.command_count).toBe(2);
    });
  });
});

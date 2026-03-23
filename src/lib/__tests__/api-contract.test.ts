/**
 * Contract tests: verify that Zod schemas match expected backend shapes.
 *
 * These tests act as a safety net: if the backend changes its response
 * format, the tests below will fail and alert us before users hit issues.
 */

import { describe, it, expect, vi } from "vitest";
import {
  BBoxSchema,
  DetectedObjectResponseSchema,
  DetectResponseSchema,
  DepthResponseSchema,
  DescribeResponseSchema,
  ModelInfoSchema,
  UsageResponseSchema,
  ErrorResponseSchema,
  DeviceResponseSchema,
  DeploymentResponseSchema,
  FleetAlertResponseSchema,
  DeviceGroupResponseSchema,
  MaintenanceWindowResponseSchema,
  validateApiResponse,
} from "../api-schemas";

// ── Fixtures ────────────────────────────────────────────────────

const VALID_BBOX = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };

const VALID_DETECTED_OBJECT = {
  label: "person",
  confidence: 0.95,
  bbox: VALID_BBOX,
};

const VALID_IMAGE_INFO = { width: 1920, height: 1080 };

const VALID_DETECT_RESPONSE = {
  model: "yolov8",
  objects: [VALID_DETECTED_OBJECT],
  image: VALID_IMAGE_INFO,
  inference_ms: 42.5,
  credits_used: 1,
};

const VALID_DEPTH_RESPONSE = {
  model: "depth-anything-v2",
  depth_map: "iVBORw0KGgoAAAANSU...",
  image: VALID_IMAGE_INFO,
  inference_ms: 120.3,
  credits_used: 2,
};

const VALID_DESCRIBE_RESPONSE = {
  model: "gpt-4o",
  description: "A person walking through a park",
  image: VALID_IMAGE_INFO,
  inference_ms: 800.1,
  credits_used: 3,
};

const VALID_DEVICE_RESPONSE = {
  id: "d-001",
  user_id: "u-001",
  name: "Edge Camera 1",
  device_type: "camera" as const,
  status: "online" as const,
  api_key: null,
  hardware_specs: {
    cpu: "ARM Cortex-A72",
    cpu_cores: 4,
    ram_gb: 4,
    gpu: "VideoCore VI",
    gpu_vram_gb: 0,
    disk_gb: 32,
    architecture: "aarch64",
  },
  tags: { location: "warehouse-A" },
  config_overrides: {},
  firmware_version: "1.2.0",
  current_model_id: null,
  current_model_version: null,
  ip_address: "192.168.1.10",
  last_heartbeat_at: "2025-12-01T10:00:00Z",
  registered_at: "2025-01-15T08:00:00Z",
  created_at: "2025-01-15T08:00:00Z",
  updated_at: "2025-12-01T10:00:00Z",
};

const VALID_DEPLOYMENT_RESPONSE = {
  id: "dep-001",
  user_id: "u-001",
  name: "YOLOv8 Rollout",
  model_id: "yolov8n",
  model_version: "2.0.0",
  model_url: null,
  model_checksum: null,
  strategy: "rolling" as const,
  status: "in_progress" as const,
  rollout_stages: [{ name: "canary", percentage: 10, min_wait_seconds: 300 }],
  current_stage: 0,
  target_device_ids: ["d-001", "d-002"],
  target_group_id: null,
  bandwidth_limit_mbps: null,
  rollback_version: null,
  started_at: "2025-12-01T12:00:00Z",
  completed_at: null,
  created_at: "2025-12-01T11:00:00Z",
  updated_at: "2025-12-01T12:00:00Z",
};

const VALID_ALERT_RESPONSE = {
  id: "alert-001",
  user_id: "u-001",
  device_id: "d-001",
  deployment_id: null,
  alert_type: "device_offline" as const,
  severity: "warning" as const,
  title: "Device offline",
  message: "Edge Camera 1 has not sent a heartbeat in 10 minutes",
  resolved: false,
  resolved_at: null,
  created_at: "2025-12-01T10:10:00Z",
};

const VALID_GROUP_RESPONSE = {
  id: "g-001",
  user_id: "u-001",
  name: "Warehouse cameras",
  description: "All cameras in warehouse A",
  tag_filter: { location: "warehouse-A" },
  auto_scaling_policy: null,
  device_count: 5,
  created_at: "2025-06-01T08:00:00Z",
  updated_at: "2025-12-01T08:00:00Z",
};

const VALID_MAINTENANCE_RESPONSE = {
  id: "mw-001",
  user_id: "u-001",
  name: "Weekly reboot",
  description: "Scheduled weekly reboot for all devices",
  device_ids: ["d-001", "d-002"],
  group_id: null,
  starts_at: "2025-12-07T02:00:00Z",
  ends_at: "2025-12-07T04:00:00Z",
  recurrence: "weekly",
  is_active: true,
  created_at: "2025-11-01T08:00:00Z",
  updated_at: "2025-12-01T08:00:00Z",
};

// ── API model schema tests ──────────────────────────────────────

describe("API model schemas", () => {
  it("validates BBox", () => {
    expect(BBoxSchema.safeParse(VALID_BBOX).success).toBe(true);
  });

  it("validates DetectedObjectResponse", () => {
    expect(DetectedObjectResponseSchema.safeParse(VALID_DETECTED_OBJECT).success).toBe(true);
  });

  it("validates DetectResponse", () => {
    expect(DetectResponseSchema.safeParse(VALID_DETECT_RESPONSE).success).toBe(true);
  });

  it("validates DepthResponse", () => {
    expect(DepthResponseSchema.safeParse(VALID_DEPTH_RESPONSE).success).toBe(true);
  });

  it("validates DescribeResponse", () => {
    expect(DescribeResponseSchema.safeParse(VALID_DESCRIBE_RESPONSE).success).toBe(true);
  });

  it("validates ModelInfo", () => {
    const valid = {
      id: "yolov8n",
      name: "YOLOv8 Nano",
      task: "detection",
      credits_per_call: 1,
      description: "Lightweight object detection",
    };
    expect(ModelInfoSchema.safeParse(valid).success).toBe(true);
  });

  it("validates ModelInfo with missing optional description", () => {
    const minimal = { id: "yolov8n", name: "YOLOv8 Nano", task: "detection", credits_per_call: 1 };
    const result = ModelInfoSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("validates UsageResponse", () => {
    const valid = { balance: 500 };
    const result = UsageResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_requests).toBe(0);
      expect(result.data.truncated).toBe(false);
    }
  });

  it("validates ErrorResponse", () => {
    const valid = { error: "not_found", message: "Device not found", status_code: 404 };
    expect(ErrorResponseSchema.safeParse(valid).success).toBe(true);
  });
});

// ── Fleet schema tests ──────────────────────────────────────────

describe("Fleet response schemas", () => {
  it("validates DeviceResponse", () => {
    expect(DeviceResponseSchema.safeParse(VALID_DEVICE_RESPONSE).success).toBe(true);
  });

  it("validates DeploymentResponse", () => {
    expect(DeploymentResponseSchema.safeParse(VALID_DEPLOYMENT_RESPONSE).success).toBe(true);
  });

  it("validates FleetAlertResponse", () => {
    expect(FleetAlertResponseSchema.safeParse(VALID_ALERT_RESPONSE).success).toBe(true);
  });

  it("validates DeviceGroupResponse", () => {
    expect(DeviceGroupResponseSchema.safeParse(VALID_GROUP_RESPONSE).success).toBe(true);
  });

  it("validates MaintenanceWindowResponse", () => {
    expect(MaintenanceWindowResponseSchema.safeParse(VALID_MAINTENANCE_RESPONSE).success).toBe(true);
  });
});

// ── Malformed data tests ────────────────────────────────────────

describe("Schema rejection of malformed data", () => {
  it("rejects BBox with missing fields", () => {
    expect(BBoxSchema.safeParse({ x: 0.1 }).success).toBe(false);
  });

  it("rejects BBox with string values", () => {
    expect(BBoxSchema.safeParse({ x: "0.1", y: "0.2", w: "0.3", h: "0.4" }).success).toBe(false);
  });

  it("rejects DetectResponse with missing image field", () => {
    const bad = { ...VALID_DETECT_RESPONSE, image: undefined };
    expect(DetectResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects DeviceResponse with invalid status enum", () => {
    const bad = { ...VALID_DEVICE_RESPONSE, status: "unknown_status" };
    expect(DeviceResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects DeviceResponse with invalid device_type enum", () => {
    const bad = { ...VALID_DEVICE_RESPONSE, device_type: "spaceship" };
    expect(DeviceResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects DeploymentResponse with invalid strategy", () => {
    const bad = { ...VALID_DEPLOYMENT_RESPONSE, strategy: "yolo" };
    expect(DeploymentResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects ErrorResponse with missing message", () => {
    expect(ErrorResponseSchema.safeParse({ error: "oops", status_code: 500 }).success).toBe(false);
  });

  it("rejects completely empty object for DeviceResponse", () => {
    expect(DeviceResponseSchema.safeParse({}).success).toBe(false);
  });
});

// ── validateApiResponse helper tests ────────────────────────────

describe("validateApiResponse", () => {
  it("returns parsed data on valid input", () => {
    const result = validateApiResponse(BBoxSchema, VALID_BBOX, "test");
    expect(result).toEqual(VALID_BBOX);
  });

  it("applies defaults from the schema", () => {
    const result = validateApiResponse(UsageResponseSchema, { balance: 100 }, "usage");
    expect(result.total_requests).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("logs warning and returns original data on invalid input", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const badData = { x: "not-a-number" };
    const result = validateApiResponse(BBoxSchema, badData, "bbox");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[API contract: bbox]");
    // Returns original data for graceful degradation
    expect(result).toBe(badData);
    warnSpy.mockRestore();
  });

  it("works without context parameter", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateApiResponse(BBoxSchema, {});
    expect(warnSpy.mock.calls[0][0]).toContain("[API contract]");
    warnSpy.mockRestore();
  });

  it("validates array of DeviceResponses", () => {
    const { z } = require("zod");
    const arraySchema = z.array(DeviceResponseSchema);
    const result = validateApiResponse(arraySchema, [VALID_DEVICE_RESPONSE], "listDevices");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("d-001");
  });
});

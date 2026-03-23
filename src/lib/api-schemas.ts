/**
 * Zod schemas that mirror backend Pydantic models.
 *
 * These schemas serve as a runtime contract between the frontend and backend.
 * The `validateApiResponse` helper validates data without throwing so the UI
 * degrades gracefully when the backend shape drifts.
 */

import { z } from "zod";

// ── Hosted-API response schemas (mirrors backend/src/fleet/models/api_models.py) ──

export const BBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const DetectedObjectResponseSchema = z.object({
  label: z.string(),
  confidence: z.number(),
  bbox: BBoxSchema,
});

export const ImageInfoResponseSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
});

export const DetectResponseSchema = z.object({
  model: z.string(),
  objects: z.array(DetectedObjectResponseSchema),
  image: ImageInfoResponseSchema,
  inference_ms: z.number(),
  credits_used: z.number().int(),
});

export const DepthResponseSchema = z.object({
  model: z.string(),
  depth_map: z.string(),
  image: ImageInfoResponseSchema,
  inference_ms: z.number(),
  credits_used: z.number().int(),
});

export const DescribeResponseSchema = z.object({
  model: z.string(),
  description: z.string(),
  image: ImageInfoResponseSchema,
  inference_ms: z.number(),
  credits_used: z.number().int(),
});

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  task: z.string(),
  credits_per_call: z.number().int(),
  description: z.string().optional().default(""),
});

export const UsageResponseSchema = z.object({
  balance: z.number().int(),
  total_requests: z.number().int().optional().default(0),
  total_credits_used: z.number().int().optional().default(0),
  by_endpoint: z.record(z.string(), z.number().int()).optional().default({}),
  daily_credits: z.record(z.string(), z.number().int()).optional().default({}),
  truncated: z.boolean().optional().default(false),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  status_code: z.number().int(),
});

// ── Fleet response schemas (mirrors src/types/fleet.ts) ──

const DeviceStatusSchema = z.enum([
  "pending",
  "online",
  "offline",
  "maintenance",
  "error",
  "decommissioned",
]);

const DeviceTypeSchema = z.enum([
  "camera",
  "robot",
  "edge_node",
  "gateway",
  "drone",
]);

const DeploymentStatusSchema = z.enum([
  "pending",
  "in_progress",
  "paused",
  "completed",
  "rolling_back",
  "rolled_back",
  "failed",
]);

const DeploymentStrategySchema = z.enum([
  "canary",
  "rolling",
  "blue_green",
  "all_at_once",
]);

const AlertSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

const AlertTypeSchema = z.enum([
  "device_offline",
  "high_resource_usage",
  "deployment_failed",
  "ota_failed",
  "heartbeat_missed",
  "temperature_high",
  "disk_full",
]);

export const HardwareSpecsSchema = z.object({
  cpu: z.string(),
  cpu_cores: z.number(),
  ram_gb: z.number(),
  gpu: z.string(),
  gpu_vram_gb: z.number(),
  disk_gb: z.number(),
  architecture: z.string(),
});

export const ResourceUsageSchema = z.object({
  cpu_percent: z.number(),
  memory_percent: z.number(),
  memory_used_gb: z.number(),
  disk_percent: z.number(),
  disk_used_gb: z.number(),
  gpu_percent: z.number().nullable().optional(),
  gpu_memory_percent: z.number().nullable().optional(),
  gpu_temp_celsius: z.number().nullable().optional(),
  cpu_temp_celsius: z.number().nullable().optional(),
});

export const DeviceResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  device_type: DeviceTypeSchema,
  status: DeviceStatusSchema,
  api_key: z.string().nullable().optional(),
  hardware_specs: HardwareSpecsSchema,
  tags: z.record(z.string(), z.string()),
  config_overrides: z.record(z.string(), z.unknown()),
  firmware_version: z.string().nullable().optional(),
  current_model_id: z.string().nullable().optional(),
  current_model_version: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  last_heartbeat_at: z.string().nullable().optional(),
  registered_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RolloutStageSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  min_wait_seconds: z.number(),
});

export const DeploymentResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  model_id: z.string(),
  model_version: z.string(),
  model_url: z.string().nullable().optional(),
  model_checksum: z.string().nullable().optional(),
  strategy: DeploymentStrategySchema,
  status: DeploymentStatusSchema,
  rollout_stages: z.array(RolloutStageSchema),
  current_stage: z.number().int(),
  target_device_ids: z.array(z.string()),
  target_group_id: z.string().nullable().optional(),
  bandwidth_limit_mbps: z.number().nullable().optional(),
  rollback_version: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DeploymentDeviceStatusResponseSchema = z.object({
  id: z.string(),
  deployment_id: z.string(),
  device_id: z.string(),
  status: z.string(),
  stage: z.number().int(),
  progress: z.number(),
  error_message: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const AutoScalingPolicySchema = z.object({
  enabled: z.boolean(),
  min_devices: z.number().int(),
  max_devices: z.number().int(),
  target_cpu_percent: z.number(),
  scale_up_threshold: z.number(),
  scale_down_threshold: z.number(),
  cooldown_seconds: z.number().int(),
});

export const DeviceGroupResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  description: z.string(),
  tag_filter: z.record(z.string(), z.string()),
  auto_scaling_policy: AutoScalingPolicySchema.nullable().optional(),
  device_count: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const MaintenanceWindowResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  description: z.string(),
  device_ids: z.array(z.string()),
  group_id: z.string().nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  recurrence: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const FleetAlertResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  device_id: z.string().nullable().optional(),
  deployment_id: z.string().nullable().optional(),
  alert_type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  title: z.string(),
  message: z.string(),
  resolved: z.boolean(),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string(),
});

// ── Inferred types ──────────────────────────────────────────────

export type BBox = z.infer<typeof BBoxSchema>;
export type DetectedObjectResponse = z.infer<typeof DetectedObjectResponseSchema>;
export type ImageInfoResponse = z.infer<typeof ImageInfoResponseSchema>;
export type DetectResponse = z.infer<typeof DetectResponseSchema>;
export type DepthResponse = z.infer<typeof DepthResponseSchema>;
export type DescribeResponse = z.infer<typeof DescribeResponseSchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export type DeviceResponseValidated = z.infer<typeof DeviceResponseSchema>;
export type DeploymentResponseValidated = z.infer<typeof DeploymentResponseSchema>;
export type DeploymentDeviceStatusResponseValidated = z.infer<typeof DeploymentDeviceStatusResponseSchema>;
export type DeviceGroupResponseValidated = z.infer<typeof DeviceGroupResponseSchema>;
export type MaintenanceWindowResponseValidated = z.infer<typeof MaintenanceWindowResponseSchema>;
export type FleetAlertResponseValidated = z.infer<typeof FleetAlertResponseSchema>;

// ── Validation helper ───────────────────────────────────────────

/**
 * Validate an API response against a Zod schema.
 *
 * On success, returns the parsed (and potentially coerced/defaulted) data.
 * On failure, logs a warning and returns the original data unchanged so the
 * UI can degrade gracefully rather than crashing.
 */
export function validateApiResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const tag = context ? `[API contract: ${context}]` : "[API contract]";
  console.warn(
    `${tag} Response validation failed. The backend may have changed its schema.`,
    result.error.issues,
  );

  // Return original data cast to T so callers keep working even when
  // the schema is slightly out of date.
  return data as T;
}

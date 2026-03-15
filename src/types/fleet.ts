/** TypeScript mirrors of backend/src/fleet/models.py Pydantic models. */

// ── Enums ──────────────────────────────────────────────────────

export type DeviceStatus = "pending" | "online" | "offline" | "maintenance" | "error" | "decommissioned";
export type DeviceType = "camera" | "robot" | "edge_node" | "gateway" | "drone";
export type DeploymentStatus = "pending" | "in_progress" | "paused" | "completed" | "rolling_back" | "rolled_back" | "failed";
export type DeploymentStrategy = "canary" | "rolling" | "blue_green" | "all_at_once";
export type AlertSeverity = "info" | "warning" | "error" | "critical";
export type AlertType = "device_offline" | "high_resource_usage" | "deployment_failed" | "ota_failed" | "heartbeat_missed" | "temperature_high" | "disk_full";
export type CommandType = "restart" | "update_config" | "deploy_model" | "rollback_model" | "ota_update" | "decommission" | "collect_logs";
export type CommandStatus = "pending" | "acked" | "in_progress" | "completed" | "failed";

// ── Hardware & Resources ───────────────────────────────────────

export interface HardwareSpecs {
  cpu: string;
  cpu_cores: number;
  ram_gb: number;
  gpu: string;
  gpu_vram_gb: number;
  disk_gb: number;
  architecture: string;
}

export interface ResourceUsage {
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  gpu_percent?: number | null;
  gpu_memory_percent?: number | null;
  gpu_temp_celsius?: number | null;
  cpu_temp_celsius?: number | null;
}

// ── Device ─────────────────────────────────────────────────────

export interface DeviceRegisterRequest {
  name: string;
  device_type?: DeviceType;
  hardware_specs?: HardwareSpecs;
  tags?: Record<string, string>;
  firmware_version?: string;
  ip_address?: string;
}

export interface DeviceResponse {
  id: string;
  user_id: string;
  name: string;
  device_type: DeviceType;
  status: DeviceStatus;
  api_key?: string | null;
  hardware_specs: HardwareSpecs;
  tags: Record<string, string>;
  config_overrides: Record<string, unknown>;
  firmware_version?: string | null;
  current_model_id?: string | null;
  current_model_version?: string | null;
  ip_address?: string | null;
  last_heartbeat_at?: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceUpdateRequest {
  name?: string;
  device_type?: DeviceType;
  tags?: Record<string, string>;
  config_overrides?: Record<string, unknown>;
  firmware_version?: string;
}

// ── Heartbeat ──────────────────────────────────────────────────

export interface HeartbeatRequest {
  device_id: string;
  resource_usage?: ResourceUsage;
  firmware_version?: string;
  model_version?: string;
  agent_version?: string;
  ip_address?: string;
}

export interface PendingCommand {
  id: string;
  command_type: CommandType;
  payload: Record<string, unknown>;
}

export interface HeartbeatResponse {
  status: string;
  server_time: string;
  pending_commands: PendingCommand[];
}

// ── Deployments ────────────────────────────────────────────────

export interface RolloutStage {
  name: string;
  percentage: number;
  min_wait_seconds: number;
}

export interface DeploymentCreateRequest {
  name: string;
  model_id: string;
  model_version: string;
  model_url?: string;
  model_checksum?: string;
  strategy?: DeploymentStrategy;
  rollout_stages?: RolloutStage[];
  target_device_ids?: string[];
  target_group_id?: string;
  bandwidth_limit_mbps?: number;
}

export interface DeploymentResponse {
  id: string;
  user_id: string;
  name: string;
  model_id: string;
  model_version: string;
  model_url?: string | null;
  model_checksum?: string | null;
  strategy: DeploymentStrategy;
  status: DeploymentStatus;
  rollout_stages: RolloutStage[];
  current_stage: number;
  target_device_ids: string[];
  target_group_id?: string | null;
  bandwidth_limit_mbps?: number | null;
  rollback_version?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeploymentDeviceStatusResponse {
  id: string;
  deployment_id: string;
  device_id: string;
  status: string;
  stage: number;
  progress: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

// ── Device Groups ──────────────────────────────────────────────

export interface AutoScalingPolicy {
  enabled: boolean;
  min_devices: number;
  max_devices: number;
  target_cpu_percent: number;
  scale_up_threshold: number;
  scale_down_threshold: number;
  cooldown_seconds: number;
}

export interface DeviceGroupCreateRequest {
  name: string;
  description?: string;
  tag_filter?: Record<string, string>;
}

export interface DeviceGroupResponse {
  id: string;
  user_id: string;
  name: string;
  description: string;
  tag_filter: Record<string, string>;
  auto_scaling_policy?: AutoScalingPolicy | null;
  device_count: number;
  created_at: string;
  updated_at: string;
}

// ── Maintenance ────────────────────────────────────────────────

export interface MaintenanceWindowCreateRequest {
  name: string;
  description?: string;
  device_ids?: string[];
  group_id?: string;
  starts_at: string;
  ends_at: string;
  recurrence?: string;
}

export interface MaintenanceWindowResponse {
  id: string;
  user_id: string;
  name: string;
  description: string;
  device_ids: string[];
  group_id?: string | null;
  starts_at: string;
  ends_at: string;
  recurrence?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── OTA ────────────────────────────────────────────────────────

export interface OTAUpdateRequest {
  device_ids: string[];
  firmware_url: string;
  firmware_version: string;
  checksum: string;
  bandwidth_limit_mbps?: number;
  force?: boolean;
}

// ── Decommission ───────────────────────────────────────────────

export interface DecommissionRequest {
  reason?: string;
  wipe_data?: boolean;
}

// ── Alerts ─────────────────────────────────────────────────────

export interface FleetAlertResponse {
  id: string;
  user_id: string;
  device_id?: string | null;
  deployment_id?: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  resolved: boolean;
  resolved_at?: string | null;
  created_at: string;
}

// ── Batch Operations ───────────────────────────────────────────

export interface BatchDeviceRequest {
  tag_filter: Record<string, string>;
  action: string;
  payload?: Record<string, unknown>;
}

// ── Fleet Summary (computed on frontend) ───────────────────────

export interface FleetSummary {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  error_devices: number;
  active_deployments: number;
  unresolved_alerts: number;
}

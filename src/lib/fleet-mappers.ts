/**
 * DB-row-to-API-response mappers for the cloud fleet client.
 */

import type { Database } from "@/integrations/supabase/types";
import type {
  DeviceResponse,
  DeploymentResponse,
  DeploymentDeviceStatusResponse,
  DeviceGroupResponse,
  MaintenanceWindowResponse,
  FleetAlertResponse,
} from "@/types/fleet";

export type Tables = Database["public"]["Tables"];
export type DeviceRow = Tables["devices"]["Row"];
export type DeploymentRow = Tables["deployments"]["Row"];
export type DeploymentDeviceStatusRow = Tables["deployment_device_status"]["Row"];
export type DeviceGroupRow = Tables["device_groups"]["Row"];
export type MaintenanceWindowRow = Tables["maintenance_windows"]["Row"];
export type FleetAlertRow = Tables["fleet_alerts"]["Row"];

// ── Mappers (DB rows → API response shapes) ───────────────────

export function mapDevice(row: DeviceRow): DeviceResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    device_type: (row.device_type || "edge_node") as DeviceResponse["device_type"],
    status: (row.status || "offline") as DeviceResponse["status"],
    api_key: null,
    hardware_specs: (row.hardware_specs || {}) as DeviceResponse["hardware_specs"],
    tags: (row.tags || {}) as Record<string, string>,
    config_overrides: (row.config_overrides || {}) as Record<string, unknown>,
    firmware_version: row.firmware_version,
    current_model_id: row.current_model_id,
    current_model_version: row.current_model_version,
    ip_address: row.ip_address,
    last_heartbeat_at: row.last_heartbeat_at || row.last_seen_at,
    registered_at: row.registered_at || row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

export function mapDeployment(row: DeploymentRow): DeploymentResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    model_id: row.model_id,
    model_version: row.model_version,
    model_url: row.model_url,
    model_checksum: row.model_checksum,
    strategy: (row.strategy || "rolling") as DeploymentResponse["strategy"],
    status: (row.status || "pending") as DeploymentResponse["status"],
    rollout_stages: (row.rollout_stages || []) as DeploymentResponse["rollout_stages"],
    current_stage: row.current_stage || 0,
    target_device_ids: (row.target_device_ids || []) as string[],
    target_group_id: row.target_group_id,
    bandwidth_limit_mbps: row.bandwidth_limit_mbps,
    rollback_version: row.rollback_version,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapDeploymentDeviceStatus(row: DeploymentDeviceStatusRow): DeploymentDeviceStatusResponse {
  return {
    id: row.id,
    deployment_id: row.deployment_id,
    device_id: row.device_id,
    status: row.status || "pending",
    stage: row.stage || 0,
    progress: row.progress || 0,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

export function mapGroup(row: DeviceGroupRow): DeviceGroupResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || "",
    tag_filter: (row.tag_filter || {}) as Record<string, string>,
    auto_scaling_policy: row.auto_scaling_policy as DeviceGroupResponse["auto_scaling_policy"],
    device_count: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMaintenance(row: MaintenanceWindowRow): MaintenanceWindowResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || "",
    device_ids: (row.device_ids || []) as string[],
    group_id: row.group_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    recurrence: row.recurrence,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapAlert(row: FleetAlertRow): FleetAlertResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    device_id: row.device_id,
    deployment_id: row.deployment_id,
    alert_type: row.alert_type as FleetAlertResponse["alert_type"],
    severity: (row.severity || "info") as FleetAlertResponse["severity"],
    title: row.title,
    message: row.message || "",
    resolved: row.resolved ?? false,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
  };
}

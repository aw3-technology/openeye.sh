/**
 * Fleet Management client — uses Supabase directly for all CRUD operations.
 * Replaces the old HTTP client that required a local server on port 8001.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DeviceRegisterRequest,
  DeviceResponse,
  DeviceUpdateRequest,
  DeploymentCreateRequest,
  DeploymentResponse,
  DeploymentDeviceStatusResponse,
  DeviceGroupCreateRequest,
  DeviceGroupResponse,
  MaintenanceWindowCreateRequest,
  MaintenanceWindowResponse,
  FleetAlertResponse,
  AutoScalingPolicy,
  BatchDeviceRequest,
  OTAUpdateRequest,
  DecommissionRequest,
} from "@/types/fleet";

// ── Helpers ────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function assertOk<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ── Devices ────────────────────────────────────────────────────

export async function registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse> {
  const userId = await getUserId();
  const row = {
    user_id: userId,
    name: req.name,
    device_type: req.device_type || "edge_node",
    hardware_specs: req.hardware_specs || {},
    tags: req.tags || {},
    firmware_version: req.firmware_version || null,
    ip_address: req.ip_address || null,
    status: "pending",
    registered_at: new Date().toISOString(),
  };
  const result = await supabase.from("devices").insert(row).select().single();
  return mapDevice(assertOk(result));
}

export async function listDevices(params?: {
  status?: string;
  device_type?: string;
  tag_key?: string;
  tag_value?: string;
}): Promise<DeviceResponse[]> {
  let query = supabase.from("devices").select("*");
  if (params?.status) query = query.eq("status", params.status);
  if (params?.device_type) query = query.eq("device_type", params.device_type);
  const result = await query.order("created_at", { ascending: false });
  const rows = assertOk(result) as any[];
  let devices = rows.map(mapDevice);
  // Client-side tag filtering (jsonb containment would be better but this works)
  if (params?.tag_key && params?.tag_value) {
    devices = devices.filter(d => d.tags[params.tag_key!] === params.tag_value);
  }
  return devices;
}

export async function getDevice(deviceId: string): Promise<DeviceResponse> {
  const result = await supabase.from("devices").select("*").eq("id", deviceId).single();
  return mapDevice(assertOk(result));
}

export async function updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse> {
  const updates: Record<string, unknown> = {};
  if (req.name !== undefined) updates.name = req.name;
  if (req.device_type !== undefined) updates.device_type = req.device_type;
  if (req.tags !== undefined) updates.tags = req.tags;
  if (req.config_overrides !== undefined) updates.config_overrides = req.config_overrides;
  if (req.firmware_version !== undefined) updates.firmware_version = req.firmware_version;
  const result = await supabase.from("devices").update(updates).eq("id", deviceId).select().single();
  return mapDevice(assertOk(result));
}

export async function setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse> {
  const result = await supabase.from("devices").update({ tags }).eq("id", deviceId).select().single();
  return mapDevice(assertOk(result));
}

export async function setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse> {
  const result = await supabase.from("devices").update({ config_overrides: config }).eq("id", deviceId).select().single();
  return mapDevice(assertOk(result));
}

export async function getResourceHistory(deviceId: string, limit = 100) {
  const result = await supabase
    .from("device_resource_history")
    .select("resource_usage, created_at")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return assertOk(result) as Array<{ resource_usage: Record<string, number>; created_at: string }>;
}

export async function restartDevice(deviceId: string) {
  // In cloud mode, we just set the device status to trigger a restart on next heartbeat
  await supabase.from("devices").update({ status: "maintenance" }).eq("id", deviceId);
  return { status: "restart_queued", command_id: crypto.randomUUID() };
}

export async function decommissionDevice(deviceId: string, _req?: DecommissionRequest): Promise<DeviceResponse> {
  const result = await supabase
    .from("devices")
    .update({ status: "decommissioned" })
    .eq("id", deviceId)
    .select()
    .single();
  return mapDevice(assertOk(result));
}

export async function batchOperation(req: BatchDeviceRequest) {
  // Get matching devices by tag filter
  const { data: devices } = await supabase.from("devices").select("id, tags");
  const matched = (devices || []).filter(d => {
    const tags = (d.tags || {}) as Record<string, string>;
    return Object.entries(req.tag_filter).every(([k, v]) => tags[k] === v);
  });
  // Apply action
  for (const device of matched) {
    if (req.action === "restart") {
      await supabase.from("devices").update({ status: "maintenance" }).eq("id", device.id);
    }
  }
  return {
    matched: matched.length,
    commands: matched.map(d => ({ device_id: d.id, command_id: crypto.randomUUID() })),
  };
}

// ── Deployments ────────────────────────────────────────────────

export async function createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse> {
  const userId = await getUserId();
  const row = {
    user_id: userId,
    name: req.name,
    model_id: req.model_id,
    model_version: req.model_version,
    model_url: req.model_url || null,
    model_checksum: req.model_checksum || null,
    strategy: req.strategy || "rolling",
    status: "pending",
    rollout_stages: req.rollout_stages || [],
    target_device_ids: req.target_device_ids || [],
    target_group_id: req.target_group_id || null,
    bandwidth_limit_mbps: req.bandwidth_limit_mbps || null,
  };
  const result = await supabase.from("deployments").insert(row).select().single();
  return mapDeployment(assertOk(result));
}

export async function listDeployments(status?: string): Promise<DeploymentResponse[]> {
  let query = supabase.from("deployments").select("*");
  if (status) query = query.eq("status", status);
  const result = await query.order("created_at", { ascending: false });
  return (assertOk(result) as any[]).map(mapDeployment);
}

export async function getDeployment(id: string): Promise<DeploymentResponse> {
  const result = await supabase.from("deployments").select("*").eq("id", id).single();
  return mapDeployment(assertOk(result));
}

export async function getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]> {
  const result = await supabase
    .from("deployment_device_status")
    .select("*")
    .eq("deployment_id", id);
  return (assertOk(result) as any[]).map(mapDeploymentDeviceStatus);
}

export async function advanceDeployment(id: string): Promise<DeploymentResponse> {
  const current = await getDeployment(id);
  const result = await supabase
    .from("deployments")
    .update({
      current_stage: current.current_stage + 1,
      status: "in_progress",
      started_at: current.started_at || new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  return mapDeployment(assertOk(result));
}

export async function pauseDeployment(id: string): Promise<DeploymentResponse> {
  const result = await supabase
    .from("deployments")
    .update({ status: "paused" })
    .eq("id", id)
    .select()
    .single();
  return mapDeployment(assertOk(result));
}

export async function rollbackDeployment(id: string): Promise<DeploymentResponse> {
  const result = await supabase
    .from("deployments")
    .update({ status: "rolling_back" })
    .eq("id", id)
    .select()
    .single();
  return mapDeployment(assertOk(result));
}

// ── Groups ─────────────────────────────────────────────────────

export async function createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse> {
  const userId = await getUserId();
  const row = {
    user_id: userId,
    name: req.name,
    description: req.description || "",
    tag_filter: req.tag_filter || {},
  };
  const result = await supabase.from("device_groups").insert(row).select().single();
  return mapGroup(assertOk(result));
}

export async function listGroups(): Promise<DeviceGroupResponse[]> {
  const result = await supabase.from("device_groups").select("*").order("created_at", { ascending: false });
  const groups = (assertOk(result) as any[]).map(mapGroup);
  // Fetch member counts
  for (const group of groups) {
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id);
    group.device_count = count || 0;
  }
  return groups;
}

export async function getGroup(id: string): Promise<DeviceGroupResponse> {
  const result = await supabase.from("device_groups").select("*").eq("id", id).single();
  const group = mapGroup(assertOk(result));
  const { count } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", id);
  group.device_count = count || 0;
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  const result = await supabase.from("device_groups").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function addGroupMember(groupId: string, deviceId: string) {
  const userId = await getUserId();
  const result = await supabase
    .from("group_members")
    .insert({ group_id: groupId, device_id: deviceId, user_id: userId });
  if (result.error) throw new Error(result.error.message);
}

export async function removeGroupMember(groupId: string, deviceId: string) {
  const result = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("device_id", deviceId);
  if (result.error) throw new Error(result.error.message);
}

export async function listGroupMembers(groupId: string): Promise<DeviceResponse[]> {
  const result = await supabase
    .from("group_members")
    .select("device_id")
    .eq("group_id", groupId);
  const memberRows = assertOk(result) as Array<{ device_id: string }>;
  if (memberRows.length === 0) return [];
  const deviceIds = memberRows.map(m => m.device_id);
  const devResult = await supabase.from("devices").select("*").in("id", deviceIds);
  return (assertOk(devResult) as any[]).map(mapDevice);
}

export async function setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse> {
  const result = await supabase
    .from("device_groups")
    .update({ auto_scaling_policy: policy as any })
    .eq("id", groupId)
    .select()
    .single();
  return mapGroup(assertOk(result));
}

// ── Maintenance ────────────────────────────────────────────────

export async function createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse> {
  const userId = await getUserId();
  const row = {
    user_id: userId,
    name: req.name,
    description: req.description || "",
    device_ids: req.device_ids || [],
    group_id: req.group_id || null,
    starts_at: req.starts_at,
    ends_at: req.ends_at,
    recurrence: req.recurrence || null,
  };
  const result = await supabase.from("maintenance_windows").insert(row).select().single();
  return mapMaintenance(assertOk(result));
}

export async function listMaintenanceWindows(activeOnly = false): Promise<MaintenanceWindowResponse[]> {
  let query = supabase.from("maintenance_windows").select("*");
  if (activeOnly) query = query.eq("is_active", true);
  const result = await query.order("starts_at", { ascending: false });
  return (assertOk(result) as any[]).map(mapMaintenance);
}

export async function deleteMaintenanceWindow(id: string): Promise<void> {
  const result = await supabase.from("maintenance_windows").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

// ── Alerts ─────────────────────────────────────────────────────

export async function listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]> {
  let query = supabase.from("fleet_alerts").select("*");
  if (resolved !== undefined) query = query.eq("resolved", resolved);
  if (severity) query = query.eq("severity", severity);
  const result = await query.order("created_at", { ascending: false });
  return (assertOk(result) as any[]).map(mapAlert);
}

export async function resolveAlert(id: string): Promise<FleetAlertResponse> {
  const result = await supabase
    .from("fleet_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return mapAlert(assertOk(result));
}

// ── OTA ────────────────────────────────────────────────────────

export async function pushOTAUpdate(req: OTAUpdateRequest) {
  // Queue OTA by updating device firmware targets
  for (const deviceId of req.device_ids) {
    await supabase.from("devices").update({
      firmware_version: req.firmware_version,
      status: "maintenance",
    }).eq("id", deviceId);
  }
  return { status: "ota_queued", command_count: req.device_ids.length };
}

// ── Mappers (DB rows → API response shapes) ───────────────────

function mapDevice(row: any): DeviceResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    device_type: row.device_type || "edge_node",
    status: row.status || "offline",
    api_key: null,
    hardware_specs: row.hardware_specs || {},
    tags: row.tags || {},
    config_overrides: row.config_overrides || {},
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

function mapDeployment(row: any): DeploymentResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    model_id: row.model_id,
    model_version: row.model_version,
    model_url: row.model_url,
    model_checksum: row.model_checksum,
    strategy: row.strategy || "rolling",
    status: row.status || "pending",
    rollout_stages: row.rollout_stages || [],
    current_stage: row.current_stage || 0,
    target_device_ids: row.target_device_ids || [],
    target_group_id: row.target_group_id,
    bandwidth_limit_mbps: row.bandwidth_limit_mbps,
    rollback_version: row.rollback_version,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDeploymentDeviceStatus(row: any): DeploymentDeviceStatusResponse {
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

function mapGroup(row: any): DeviceGroupResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || "",
    tag_filter: row.tag_filter || {},
    auto_scaling_policy: row.auto_scaling_policy,
    device_count: 0, // filled in by caller
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapMaintenance(row: any): MaintenanceWindowResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || "",
    device_ids: row.device_ids || [],
    group_id: row.group_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    recurrence: row.recurrence,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAlert(row: any): FleetAlertResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    device_id: row.device_id,
    deployment_id: row.deployment_id,
    alert_type: row.alert_type,
    severity: row.severity || "info",
    title: row.title,
    message: row.message || "",
    resolved: row.resolved ?? false,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
  };
}

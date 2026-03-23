/**
 * Fleet Management client — Cloud (Supabase) implementation.
 * Used when the app is running in production/cloud mode.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
  MaintenanceWindowUpdateRequest,
  MaintenanceWindowResponse,
  FleetAlertResponse,
  AutoScalingPolicy,
  BatchDeviceRequest,
  OTAUpdateRequest,
  DecommissionRequest,
} from "@/types/fleet";
import type { FleetClientInterface } from "./fleet-client-interface";
import {
  getUserId,
  assertOk,
  mapDevice,
  mapDeployment,
  mapDeploymentDeviceStatus,
  mapGroup,
  mapMaintenance,
  mapAlert,
  type Tables,
  type DeviceRow,
  type DeploymentRow,
  type DeploymentDeviceStatusRow,
  type DeviceGroupRow,
  type MaintenanceWindowRow,
  type FleetAlertRow,
} from "./fleet-cloud-helpers";

// ── Cloud Fleet Client ────────────────────────────────────────

export class CloudFleetClient implements FleetClientInterface {
  // ── Devices ──────────────────────────────────────────────────

  async registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse> {
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

  async listDevices(params?: { status?: string; device_type?: string; tag_key?: string; tag_value?: string }): Promise<DeviceResponse[]> {
    let query = supabase.from("devices").select("*");
    if (params?.status) query = query.eq("status", params.status);
    if (params?.device_type) query = query.eq("device_type", params.device_type);
    const result = await query.order("created_at", { ascending: false });
    const rows = assertOk(result) as DeviceRow[];
    let devices = rows.map(mapDevice);
    if (params?.tag_key && params?.tag_value) {
      devices = devices.filter(d => d.tags[params.tag_key!] === params.tag_value);
    }
    return devices;
  }

  async getDevice(deviceId: string): Promise<DeviceResponse> {
    const result = await supabase.from("devices").select("*").eq("id", deviceId).single();
    return mapDevice(assertOk(result));
  }

  async updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse> {
    const updates: Record<string, unknown> = {};
    if (req.name !== undefined) updates.name = req.name;
    if (req.device_type !== undefined) updates.device_type = req.device_type;
    if (req.tags !== undefined) updates.tags = req.tags;
    if (req.config_overrides !== undefined) updates.config_overrides = req.config_overrides;
    if (req.firmware_version !== undefined) updates.firmware_version = req.firmware_version;
    const result = await supabase.from("devices").update(updates).eq("id", deviceId).select().single();
    return mapDevice(assertOk(result));
  }

  async setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse> {
    const result = await supabase.from("devices").update({ tags }).eq("id", deviceId).select().single();
    return mapDevice(assertOk(result));
  }

  async setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse> {
    const result = await supabase.from("devices").update({ config_overrides: config as Json }).eq("id", deviceId).select().single();
    return mapDevice(assertOk(result));
  }

  async getResourceHistory(deviceId: string, limit = 100) {
    const result = await supabase
      .from("device_resource_history")
      .select("resource_usage, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return assertOk(result) as Array<{ resource_usage: Record<string, number>; created_at: string }>;
  }

  async restartDevice(deviceId: string) {
    await supabase.from("devices").update({ status: "maintenance" }).eq("id", deviceId);
    return { status: "restart_queued", command_id: crypto.randomUUID() };
  }

  async decommissionDevice(deviceId: string, _req?: DecommissionRequest): Promise<DeviceResponse> {
    const result = await supabase
      .from("devices")
      .update({ status: "decommissioned" })
      .eq("id", deviceId)
      .select()
      .single();
    return mapDevice(assertOk(result));
  }

  async batchOperation(req: BatchDeviceRequest) {
    const { data: devices } = await supabase.from("devices").select("id, tags");
    const matched = (devices || []).filter(d => {
      const tags = (d.tags || {}) as Record<string, string>;
      return Object.entries(req.tag_filter).every(([k, v]) => tags[k] === v);
    });
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

  // ── Deployments ──────────────────────────────────────────────

  async createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse> {
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
    const result = await supabase.from("deployments").insert(row as Tables["deployments"]["Insert"]).select().single();
    return mapDeployment(assertOk(result));
  }

  async listDeployments(status?: string): Promise<DeploymentResponse[]> {
    let query = supabase.from("deployments").select("*");
    if (status) query = query.eq("status", status);
    const result = await query.order("created_at", { ascending: false });
    return (assertOk(result) as DeploymentRow[]).map(mapDeployment);
  }

  async getDeployment(id: string): Promise<DeploymentResponse> {
    const result = await supabase.from("deployments").select("*").eq("id", id).single();
    return mapDeployment(assertOk(result));
  }

  async getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]> {
    const result = await supabase
      .from("deployment_device_status")
      .select("*")
      .eq("deployment_id", id);
    return (assertOk(result) as DeploymentDeviceStatusRow[]).map(mapDeploymentDeviceStatus);
  }

  async advanceDeployment(id: string): Promise<DeploymentResponse> {
    const current = await this.getDeployment(id);
    const nextStage = current.current_stage + 1;
    const isComplete = nextStage >= current.rollout_stages.length;
    const result = await supabase
      .from("deployments")
      .update({
        current_stage: nextStage,
        status: isComplete ? "completed" : "in_progress",
        started_at: current.started_at || new Date().toISOString(),
        ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .select()
      .single();
    return mapDeployment(assertOk(result));
  }

  async pauseDeployment(id: string): Promise<DeploymentResponse> {
    const result = await supabase
      .from("deployments")
      .update({ status: "paused" })
      .eq("id", id)
      .select()
      .single();
    return mapDeployment(assertOk(result));
  }

  async rollbackDeployment(id: string): Promise<DeploymentResponse> {
    const result = await supabase
      .from("deployments")
      .update({ status: "rolling_back" })
      .eq("id", id)
      .select()
      .single();
    return mapDeployment(assertOk(result));
  }

  // ── Groups ───────────────────────────────────────────────────

  async createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse> {
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

  async listGroups(): Promise<DeviceGroupResponse[]> {
    const result = await supabase.from("device_groups").select("*").order("created_at", { ascending: false });
    const groups = (assertOk(result) as DeviceGroupRow[]).map(mapGroup);
    for (const group of groups) {
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", group.id);
      group.device_count = count || 0;
    }
    return groups;
  }

  async getGroup(id: string): Promise<DeviceGroupResponse> {
    const result = await supabase.from("device_groups").select("*").eq("id", id).single();
    const group = mapGroup(assertOk(result));
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", id);
    group.device_count = count || 0;
    return group;
  }

  async deleteGroup(id: string): Promise<void> {
    const result = await supabase.from("device_groups").delete().eq("id", id);
    if (result.error) throw new Error(result.error.message);
  }

  async addGroupMember(groupId: string, deviceId: string) {
    const userId = await getUserId();
    const result = await supabase
      .from("group_members")
      .insert({ group_id: groupId, device_id: deviceId, user_id: userId });
    if (result.error) throw new Error(result.error.message);
  }

  async removeGroupMember(groupId: string, deviceId: string) {
    const result = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("device_id", deviceId);
    if (result.error) throw new Error(result.error.message);
  }

  async listGroupMembers(groupId: string): Promise<DeviceResponse[]> {
    const result = await supabase
      .from("group_members")
      .select("device_id")
      .eq("group_id", groupId);
    const memberRows = assertOk(result) as Array<{ device_id: string }>;
    if (memberRows.length === 0) return [];
    const deviceIds = memberRows.map(m => m.device_id);
    const devResult = await supabase.from("devices").select("*").in("id", deviceIds);
    return (assertOk(devResult) as DeviceRow[]).map(mapDevice);
  }

  async setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse> {
    const result = await supabase
      .from("device_groups")
      .update({ auto_scaling_policy: policy as Json })
      .eq("id", groupId)
      .select()
      .single();
    return mapGroup(assertOk(result));
  }

  // ── Maintenance ──────────────────────────────────────────────

  async createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse> {
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

  async listMaintenanceWindows(activeOnly = false): Promise<MaintenanceWindowResponse[]> {
    let query = supabase.from("maintenance_windows").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    const result = await query.order("starts_at", { ascending: false });
    return (assertOk(result) as MaintenanceWindowRow[]).map(mapMaintenance);
  }

  async updateMaintenanceWindow(id: string, req: MaintenanceWindowUpdateRequest): Promise<MaintenanceWindowResponse> {
    const updates: Record<string, unknown> = {};
    if (req.name !== undefined) updates.name = req.name;
    if (req.description !== undefined) updates.description = req.description;
    if (req.starts_at !== undefined) updates.starts_at = req.starts_at;
    if (req.ends_at !== undefined) updates.ends_at = req.ends_at;
    if (req.recurrence !== undefined) updates.recurrence = req.recurrence;
    const result = await supabase
      .from("maintenance_windows")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return mapMaintenance(assertOk(result));
  }

  async deleteMaintenanceWindow(id: string): Promise<void> {
    const result = await supabase.from("maintenance_windows").delete().eq("id", id);
    if (result.error) throw new Error(result.error.message);
  }

  // ── Alerts ───────────────────────────────────────────────────

  async listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]> {
    let query = supabase.from("fleet_alerts").select("*");
    if (resolved !== undefined) query = query.eq("resolved", resolved);
    if (severity) query = query.eq("severity", severity);
    const result = await query.order("created_at", { ascending: false });
    return (assertOk(result) as FleetAlertRow[]).map(mapAlert);
  }

  async resolveAlert(id: string): Promise<FleetAlertResponse> {
    const result = await supabase
      .from("fleet_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return mapAlert(assertOk(result));
  }

  // ── OTA ──────────────────────────────────────────────────────

  async pushOTAUpdate(req: OTAUpdateRequest) {
    for (const deviceId of req.device_ids) {
      await supabase.from("devices").update({
        firmware_version: req.firmware_version,
        status: "maintenance",
      }).eq("id", deviceId);
    }
    return { status: "ota_queued", command_count: req.device_ids.length };
  }
}

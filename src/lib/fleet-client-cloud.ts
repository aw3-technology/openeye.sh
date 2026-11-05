/**
 * Fleet Management client — Cloud (Neon via /api/data) implementation.
 * Used when the app is running in production/cloud mode.
 */

import { api } from "@/lib/api";
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
  mapDevice,
  mapDeployment,
  mapDeploymentDeviceStatus,
  mapGroup,
  mapMaintenance,
  mapAlert,
  type DeviceRow,
  type DeploymentRow,
  type DeploymentDeviceStatusRow,
  type DeviceGroupRow,
  type MaintenanceWindowRow,
  type FleetAlertRow,
} from "./fleet-cloud-helpers";

// Command types the device agent understands (backend/src/fleet command_service).
const COMMAND_TYPES = new Set([
  "restart", "update_config", "deploy_model", "rollback_model", "ota_update", "decommission", "collect_logs",
]);

// ── Cloud Fleet Client ────────────────────────────────────────

export class CloudFleetClient implements FleetClientInterface {
  /** Queues a command for a device; its agent picks it up on the next heartbeat. */
  private async issueCommand(deviceId: string, commandType: string, payload: Record<string, unknown> = {}) {
    if (!COMMAND_TYPES.has(commandType)) throw new Error(`Unsupported command: ${commandType}`);
    return api.create<{ id: string }>("device_commands", {
      device_id: deviceId,
      command_type: commandType,
      payload,
    });
  }

  // ── Devices ──────────────────────────────────────────────────

  async registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse> {
    const row = {
      name: req.name,
      device_type: req.device_type || "edge_node",
      hardware_specs: req.hardware_specs || {},
      tags: req.tags || {},
      firmware_version: req.firmware_version || null,
      ip_address: req.ip_address || null,
      status: "pending",
      registered_at: new Date().toISOString(),
    };
    // The server generates the device key and returns it only on this call.
    const created = await api.create<DeviceRow & { api_key?: string }>("devices", row);
    return { ...mapDevice(created), api_key: created.api_key ?? null };
  }

  async listDevices(params?: { status?: string; device_type?: string; tag_key?: string; tag_value?: string }): Promise<DeviceResponse[]> {
    const { data } = await api.list<DeviceRow>("devices", {
      status: params?.status,
      device_type: params?.device_type,
    });
    let devices = data.map(mapDevice);
    if (params?.tag_key && params?.tag_value) {
      devices = devices.filter(d => d.tags[params.tag_key!] === params.tag_value);
    }
    return devices;
  }

  async getDevice(deviceId: string): Promise<DeviceResponse> {
    return mapDevice(await api.get<DeviceRow>("devices", deviceId));
  }

  async updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse> {
    const updates: Record<string, unknown> = {};
    if (req.name !== undefined) updates.name = req.name;
    if (req.device_type !== undefined) updates.device_type = req.device_type;
    if (req.tags !== undefined) updates.tags = req.tags;
    if (req.config_overrides !== undefined) updates.config_overrides = req.config_overrides;
    if (req.firmware_version !== undefined) updates.firmware_version = req.firmware_version;
    return mapDevice(await api.update<DeviceRow>("devices", deviceId, updates));
  }

  async setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse> {
    return mapDevice(await api.update<DeviceRow>("devices", deviceId, { tags }));
  }

  async setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse> {
    return mapDevice(await api.update<DeviceRow>("devices", deviceId, { config_overrides: config }));
  }

  async getResourceHistory(deviceId: string, limit = 100) {
    const { data } = await api.list<{ resource_usage: Record<string, number>; created_at: string }>(
      "device_resource_history",
      { device_id: deviceId, limit },
    );
    return data.map(({ resource_usage, created_at }) => ({ resource_usage, created_at }));
  }

  async restartDevice(deviceId: string) {
    const command = await this.issueCommand(deviceId, "restart");
    return { status: "restart_queued", command_id: command.id };
  }

  async decommissionDevice(deviceId: string, req?: DecommissionRequest): Promise<DeviceResponse> {
    await this.issueCommand(deviceId, "decommission", { ...req });
    return mapDevice(await api.update<DeviceRow>("devices", deviceId, { status: "decommissioned" }));
  }

  async batchOperation(req: BatchDeviceRequest) {
    const { data: devices } = await api.list<Pick<DeviceRow, "id" | "tags">>("devices");
    const matched = devices.filter(d => {
      const tags = (d.tags || {}) as Record<string, string>;
      return Object.entries(req.tag_filter).every(([k, v]) => tags[k] === v);
    });
    const commands = [];
    for (const device of matched) {
      const command = await this.issueCommand(device.id, req.action, req.payload ?? {});
      commands.push({ device_id: device.id, command_id: command.id });
    }
    return { matched: matched.length, commands };
  }

  // ── Deployments ──────────────────────────────────────────────

  async createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse> {
    const row = {
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
    const deployment = await api.create<DeploymentRow>("deployments", row);

    // One status row per target device, as the control plane does.
    let deviceIds = req.target_device_ids ?? [];
    if (deviceIds.length === 0 && req.target_group_id) {
      const { data: members } = await api.list<{ device_id: string }>("group_members", { group_id: req.target_group_id });
      deviceIds = members.map(m => m.device_id);
    }
    for (const deviceId of deviceIds) {
      await api.create("deployment_device_status", {
        deployment_id: deployment.id,
        device_id: deviceId,
        status: "pending",
        stage: 0,
      });
    }
    return mapDeployment(deployment);
  }

  async listDeployments(status?: string): Promise<DeploymentResponse[]> {
    const { data } = await api.list<DeploymentRow>("deployments", { status });
    return data.map(mapDeployment);
  }

  async getDeployment(id: string): Promise<DeploymentResponse> {
    return mapDeployment(await api.get<DeploymentRow>("deployments", id));
  }

  async getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]> {
    const { data } = await api.list<DeploymentDeviceStatusRow>("deployment_device_status", { deployment_id: id });
    return data.map(mapDeploymentDeviceStatus);
  }

  async advanceDeployment(id: string): Promise<DeploymentResponse> {
    const current = await this.getDeployment(id);
    const nextStage = current.current_stage + 1;
    const isComplete = nextStage >= current.rollout_stages.length;
    const row = await api.update<DeploymentRow>("deployments", id, {
      current_stage: nextStage,
      status: isComplete ? "completed" : "in_progress",
      started_at: current.started_at || new Date().toISOString(),
      ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
    });
    return mapDeployment(row);
  }

  async pauseDeployment(id: string): Promise<DeploymentResponse> {
    return mapDeployment(await api.update<DeploymentRow>("deployments", id, { status: "paused" }));
  }

  async rollbackDeployment(id: string): Promise<DeploymentResponse> {
    return mapDeployment(await api.update<DeploymentRow>("deployments", id, { status: "rolling_back" }));
  }

  // ── Groups ───────────────────────────────────────────────────

  async createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse> {
    const row = {
      name: req.name,
      description: req.description || "",
      tag_filter: req.tag_filter || {},
    };
    return mapGroup(await api.create<DeviceGroupRow>("device_groups", row));
  }

  // device_count is computed by the API for device_groups rows.
  async listGroups(): Promise<DeviceGroupResponse[]> {
    const { data } = await api.list<DeviceGroupRow>("device_groups");
    return data.map(mapGroup);
  }

  async getGroup(id: string): Promise<DeviceGroupResponse> {
    return mapGroup(await api.get<DeviceGroupRow>("device_groups", id));
  }

  async deleteGroup(id: string): Promise<void> {
    await api.remove("device_groups", id);
  }

  async addGroupMember(groupId: string, deviceId: string) {
    await api.create("group_members", { group_id: groupId, device_id: deviceId });
  }

  async removeGroupMember(groupId: string, deviceId: string) {
    await api.removeWhere("group_members", { group_id: groupId, device_id: deviceId });
  }

  async listGroupMembers(groupId: string): Promise<DeviceResponse[]> {
    const { data: memberRows } = await api.list<{ device_id: string }>("group_members", { group_id: groupId });
    if (memberRows.length === 0) return [];
    const { data } = await api.list<DeviceRow>("devices", { ids: memberRows.map(m => m.device_id).join(",") });
    return data.map(mapDevice);
  }

  async setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse> {
    return mapGroup(await api.update<DeviceGroupRow>("device_groups", groupId, { auto_scaling_policy: policy }));
  }

  // ── Maintenance ──────────────────────────────────────────────

  async createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse> {
    const row = {
      name: req.name,
      description: req.description || "",
      device_ids: req.device_ids || [],
      group_id: req.group_id || null,
      starts_at: req.starts_at,
      ends_at: req.ends_at,
      recurrence: req.recurrence || null,
    };
    return mapMaintenance(await api.create<MaintenanceWindowRow>("maintenance_windows", row));
  }

  async listMaintenanceWindows(activeOnly = false): Promise<MaintenanceWindowResponse[]> {
    const { data } = await api.list<MaintenanceWindowRow>("maintenance_windows", {
      is_active: activeOnly ? true : undefined,
    });
    return data.map(mapMaintenance);
  }

  async updateMaintenanceWindow(id: string, req: MaintenanceWindowUpdateRequest): Promise<MaintenanceWindowResponse> {
    const updates: Record<string, unknown> = {};
    if (req.name !== undefined) updates.name = req.name;
    if (req.description !== undefined) updates.description = req.description;
    if (req.starts_at !== undefined) updates.starts_at = req.starts_at;
    if (req.ends_at !== undefined) updates.ends_at = req.ends_at;
    if (req.recurrence !== undefined) updates.recurrence = req.recurrence;
    return mapMaintenance(await api.update<MaintenanceWindowRow>("maintenance_windows", id, updates));
  }

  async deleteMaintenanceWindow(id: string): Promise<void> {
    await api.remove("maintenance_windows", id);
  }

  // ── Alerts ───────────────────────────────────────────────────

  async listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]> {
    const { data } = await api.list<FleetAlertRow>("fleet_alerts", { resolved, severity });
    return data.map(mapAlert);
  }

  async resolveAlert(id: string): Promise<FleetAlertResponse> {
    const row = await api.update<FleetAlertRow>("fleet_alerts", id, {
      resolved: true,
      resolved_at: new Date().toISOString(),
    });
    return mapAlert(row);
  }

  // ── OTA ──────────────────────────────────────────────────────

  async pushOTAUpdate(req: OTAUpdateRequest) {
    // The device reports its new firmware_version once the update is applied.
    const { device_ids, ...payload } = req;
    for (const deviceId of device_ids) {
      await this.issueCommand(deviceId, "ota_update", payload);
    }
    return { status: "ota_queued", command_count: device_ids.length };
  }
}

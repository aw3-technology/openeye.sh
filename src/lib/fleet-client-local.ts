/**
 * Fleet Management client — Local (HTTP) implementation.
 * Used when the app is running in development mode, hitting the local Python fleet server.
 */

import { BaseApiClient } from "./base-api-client";
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
import type { FleetClientInterface } from "./fleet-client-interface";

const FLEET_SERVER_URL_KEY = "openeye_fleet_server_url";
const DEFAULT_FLEET_URL = "http://localhost:8001";

export function getFleetServerUrl(): string {
  return localStorage.getItem(FLEET_SERVER_URL_KEY) || DEFAULT_FLEET_URL;
}

export function setFleetServerUrl(url: string) {
  localStorage.setItem(FLEET_SERVER_URL_KEY, url);
}

class FleetApiClient extends BaseApiClient {}

export class LocalFleetClient implements FleetClientInterface {
  private api: FleetApiClient;

  constructor(baseUrl?: string) {
    this.api = new FleetApiClient(baseUrl || getFleetServerUrl());
  }

  // ── Devices ──────────────────────────────────────────────────

  async registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse> {
    return this.api["request"]("/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  async listDevices(params?: { status?: string; device_type?: string; tag_key?: string; tag_value?: string }): Promise<DeviceResponse[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.device_type) qs.set("device_type", params.device_type);
    if (params?.tag_key) qs.set("tag_key", params.tag_key);
    if (params?.tag_value) qs.set("tag_value", params.tag_value);
    const query = qs.toString();
    return this.api["request"](`/devices${query ? `?${query}` : ""}`);
  }

  async getDevice(deviceId: string): Promise<DeviceResponse> {
    return this.api["request"](`/devices/${deviceId}`);
  }

  async updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse> {
    return this.api["request"](`/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  async setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse> {
    return this.api["request"](`/devices/${deviceId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tags),
    });
  }

  async setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse> {
    return this.api["request"](`/devices/${deviceId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }

  async getResourceHistory(deviceId: string, limit = 100) {
    return this.api["request"](`/devices/${deviceId}/resources?limit=${limit}`);
  }

  async restartDevice(deviceId: string) {
    return this.api["request"](`/devices/${deviceId}/restart`, { method: "POST" });
  }

  async decommissionDevice(deviceId: string, req?: DecommissionRequest): Promise<DeviceResponse> {
    return this.api["request"](`/devices/${deviceId}/decommission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req || {}),
    });
  }

  async batchOperation(req: BatchDeviceRequest) {
    return this.api["request"]("/devices/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  // ── Deployments ──────────────────────────────────────────────

  async createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse> {
    return this.api["request"]("/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  async listDeployments(status?: string): Promise<DeploymentResponse[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.api["request"](`/deployments${qs}`);
  }

  async getDeployment(id: string): Promise<DeploymentResponse> {
    return this.api["request"](`/deployments/${id}`);
  }

  async getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]> {
    return this.api["request"](`/deployments/${id}/devices`);
  }

  async advanceDeployment(id: string): Promise<DeploymentResponse> {
    return this.api["request"](`/deployments/${id}/advance`, { method: "POST" });
  }

  async pauseDeployment(id: string): Promise<DeploymentResponse> {
    return this.api["request"](`/deployments/${id}/pause`, { method: "POST" });
  }

  async rollbackDeployment(id: string): Promise<DeploymentResponse> {
    return this.api["request"](`/deployments/${id}/rollback`, { method: "POST" });
  }

  // ── Groups ───────────────────────────────────────────────────

  async createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse> {
    return this.api["request"]("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  async listGroups(): Promise<DeviceGroupResponse[]> {
    return this.api["request"]("/groups");
  }

  async getGroup(id: string): Promise<DeviceGroupResponse> {
    return this.api["request"](`/groups/${id}`);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.api["request"](`/groups/${id}`, { method: "DELETE" });
  }

  async addGroupMember(groupId: string, deviceId: string) {
    await this.api["request"](`/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  async removeGroupMember(groupId: string, deviceId: string) {
    await this.api["request"](`/groups/${groupId}/members/${deviceId}`, { method: "DELETE" });
  }

  async listGroupMembers(groupId: string): Promise<DeviceResponse[]> {
    return this.api["request"](`/groups/${groupId}/members`);
  }

  async setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse> {
    return this.api["request"](`/groups/${groupId}/scaling-policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
  }

  // ── Maintenance ──────────────────────────────────────────────

  async createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse> {
    return this.api["request"]("/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  async listMaintenanceWindows(activeOnly = false): Promise<MaintenanceWindowResponse[]> {
    const qs = activeOnly ? "?active_only=true" : "";
    return this.api["request"](`/maintenance${qs}`);
  }

  async deleteMaintenanceWindow(id: string): Promise<void> {
    await this.api["request"](`/maintenance/${id}`, { method: "DELETE" });
  }

  // ── Alerts ───────────────────────────────────────────────────

  async listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]> {
    const qs = new URLSearchParams();
    if (resolved !== undefined) qs.set("resolved", String(resolved));
    if (severity) qs.set("severity", severity);
    const query = qs.toString();
    return this.api["request"](`/alerts${query ? `?${query}` : ""}`);
  }

  async resolveAlert(id: string): Promise<FleetAlertResponse> {
    return this.api["request"](`/alerts/${id}/resolve`, { method: "POST" });
  }

  // ── OTA ──────────────────────────────────────────────────────

  async pushOTAUpdate(req: OTAUpdateRequest) {
    return this.api["request"]("/ota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }
}

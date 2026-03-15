/**
 * Fleet Management API client.
 * Extends BaseApiClient, targeting the fleet control plane (port 8001).
 */

import type {
  BatchDeviceRequest,
  DecommissionRequest,
  DeploymentCreateRequest,
  DeploymentDeviceStatusResponse,
  DeploymentResponse,
  DeviceGroupCreateRequest,
  DeviceGroupResponse,
  DeviceRegisterRequest,
  DeviceResponse,
  DeviceUpdateRequest,
  FleetAlertResponse,
  MaintenanceWindowCreateRequest,
  MaintenanceWindowResponse,
  OTAUpdateRequest,
  AutoScalingPolicy,
} from "@/types/fleet";
import { BaseApiClient } from "./base-api-client";

const FLEET_URL_KEY = "openeye_fleet_url";

export function getStoredFleetUrl(): string {
  return localStorage.getItem(FLEET_URL_KEY) || "http://localhost:8001";
}

export function setStoredFleetUrl(url: string) {
  localStorage.setItem(FLEET_URL_KEY, url);
}

export class FleetClient extends BaseApiClient {
  private token: string;

  constructor(baseUrl: string, token: string) {
    super(baseUrl);
    this.token = token;
  }

  protected override defaultHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  // ── Devices ──────────────────────────────────────────────────

  async registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse> {
    return this.request("/devices", { method: "POST", body: JSON.stringify(req) });
  }

  async listDevices(params?: {
    status?: string;
    device_type?: string;
    tag_key?: string;
    tag_value?: string;
  }): Promise<DeviceResponse[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.device_type) qs.set("device_type", params.device_type);
    if (params?.tag_key) qs.set("tag_key", params.tag_key);
    if (params?.tag_value) qs.set("tag_value", params.tag_value);
    const q = qs.toString();
    return this.request(`/devices${q ? `?${q}` : ""}`);
  }

  async getDevice(deviceId: string): Promise<DeviceResponse> {
    return this.request(`/devices/${deviceId}`);
  }

  async updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse> {
    return this.request(`/devices/${deviceId}`, { method: "PATCH", body: JSON.stringify(req) });
  }

  async setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse> {
    return this.request(`/devices/${deviceId}/tags`, { method: "PUT", body: JSON.stringify(tags) });
  }

  async setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse> {
    return this.request(`/devices/${deviceId}/config`, { method: "PUT", body: JSON.stringify(config) });
  }

  async getResourceHistory(deviceId: string, limit = 100) {
    return this.request<Array<{ resource_usage: Record<string, number>; created_at: string }>>(
      `/devices/${deviceId}/resources?limit=${limit}`
    );
  }

  async restartDevice(deviceId: string) {
    return this.request<{ status: string; command_id: string }>(`/devices/${deviceId}/restart`, {
      method: "POST",
    });
  }

  async decommissionDevice(deviceId: string, req?: DecommissionRequest): Promise<DeviceResponse> {
    return this.request(`/devices/${deviceId}`, {
      method: "DELETE",
      body: JSON.stringify(req || {}),
    });
  }

  async batchOperation(req: BatchDeviceRequest) {
    return this.request<{ matched: number; commands: Array<{ device_id: string; command_id: string }> }>(
      "/devices/batch",
      { method: "POST", body: JSON.stringify(req) }
    );
  }

  // ── Deployments ──────────────────────────────────────────────

  async createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse> {
    return this.request("/deployments", { method: "POST", body: JSON.stringify(req) });
  }

  async listDeployments(status?: string): Promise<DeploymentResponse[]> {
    const q = status ? `?status=${status}` : "";
    return this.request(`/deployments${q}`);
  }

  async getDeployment(id: string): Promise<DeploymentResponse> {
    return this.request(`/deployments/${id}`);
  }

  async getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]> {
    return this.request(`/deployments/${id}/devices`);
  }

  async advanceDeployment(id: string): Promise<DeploymentResponse> {
    return this.request(`/deployments/${id}/advance`, { method: "POST" });
  }

  async pauseDeployment(id: string): Promise<DeploymentResponse> {
    return this.request(`/deployments/${id}/pause`, { method: "POST" });
  }

  async rollbackDeployment(id: string): Promise<DeploymentResponse> {
    return this.request(`/deployments/${id}/rollback`, { method: "POST" });
  }

  // ── Groups ───────────────────────────────────────────────────

  async createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse> {
    return this.request("/groups", { method: "POST", body: JSON.stringify(req) });
  }

  async listGroups(): Promise<DeviceGroupResponse[]> {
    return this.request("/groups");
  }

  async getGroup(id: string): Promise<DeviceGroupResponse> {
    return this.request(`/groups/${id}`);
  }

  async deleteGroup(id: string): Promise<void> {
    return this.request(`/groups/${id}`, { method: "DELETE" });
  }

  async addGroupMember(groupId: string, deviceId: string) {
    return this.request(`/groups/${groupId}/members?device_id=${deviceId}`, { method: "POST" });
  }

  async removeGroupMember(groupId: string, deviceId: string) {
    return this.request(`/groups/${groupId}/members/${deviceId}`, { method: "DELETE" });
  }

  async listGroupMembers(groupId: string): Promise<DeviceResponse[]> {
    return this.request(`/groups/${groupId}/members`);
  }

  async setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse> {
    return this.request(`/groups/${groupId}/scaling`, { method: "PUT", body: JSON.stringify(policy) });
  }

  // ── Maintenance ──────────────────────────────────────────────

  async createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse> {
    return this.request("/maintenance", { method: "POST", body: JSON.stringify(req) });
  }

  async listMaintenanceWindows(activeOnly = false): Promise<MaintenanceWindowResponse[]> {
    return this.request(`/maintenance?active_only=${activeOnly}`);
  }

  async deleteMaintenanceWindow(id: string): Promise<void> {
    return this.request(`/maintenance/${id}`, { method: "DELETE" });
  }

  // ── Alerts ───────────────────────────────────────────────────

  async listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]> {
    const qs = new URLSearchParams();
    if (resolved !== undefined) qs.set("resolved", String(resolved));
    if (severity) qs.set("severity", severity);
    const q = qs.toString();
    return this.request(`/alerts${q ? `?${q}` : ""}`);
  }

  async resolveAlert(id: string): Promise<FleetAlertResponse> {
    return this.request(`/alerts/${id}/resolve`, { method: "POST" });
  }

  // ── OTA ──────────────────────────────────────────────────────

  async pushOTAUpdate(req: OTAUpdateRequest) {
    return this.request<{ status: string; command_count: number }>("/ota/update", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }
}

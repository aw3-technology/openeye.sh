/**
 * Shared interface for fleet client implementations (cloud vs local).
 * Both CloudFleetClient and LocalFleetClient implement this.
 */

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

export interface FleetClientInterface {
  // Devices
  registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse>;
  listDevices(params?: { status?: string; device_type?: string; tag_key?: string; tag_value?: string }): Promise<DeviceResponse[]>;
  getDevice(deviceId: string): Promise<DeviceResponse>;
  updateDevice(deviceId: string, req: DeviceUpdateRequest): Promise<DeviceResponse>;
  setTags(deviceId: string, tags: Record<string, string>): Promise<DeviceResponse>;
  setConfigOverrides(deviceId: string, config: Record<string, unknown>): Promise<DeviceResponse>;
  getResourceHistory(deviceId: string, limit?: number): Promise<Array<{ resource_usage: Record<string, number>; created_at: string }>>;
  restartDevice(deviceId: string): Promise<{ status: string; command_id: string }>;
  decommissionDevice(deviceId: string, req?: DecommissionRequest): Promise<DeviceResponse>;
  batchOperation(req: BatchDeviceRequest): Promise<{ matched: number; commands: Array<{ device_id: string; command_id: string }> }>;

  // Deployments
  createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse>;
  listDeployments(status?: string): Promise<DeploymentResponse[]>;
  getDeployment(id: string): Promise<DeploymentResponse>;
  getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]>;
  advanceDeployment(id: string): Promise<DeploymentResponse>;
  pauseDeployment(id: string): Promise<DeploymentResponse>;
  rollbackDeployment(id: string): Promise<DeploymentResponse>;

  // Groups
  createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse>;
  listGroups(): Promise<DeviceGroupResponse[]>;
  getGroup(id: string): Promise<DeviceGroupResponse>;
  deleteGroup(id: string): Promise<void>;
  addGroupMember(groupId: string, deviceId: string): Promise<void>;
  removeGroupMember(groupId: string, deviceId: string): Promise<void>;
  listGroupMembers(groupId: string): Promise<DeviceResponse[]>;
  setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse>;

  // Maintenance
  createMaintenanceWindow(req: MaintenanceWindowCreateRequest): Promise<MaintenanceWindowResponse>;
  listMaintenanceWindows(activeOnly?: boolean): Promise<MaintenanceWindowResponse[]>;
  deleteMaintenanceWindow(id: string): Promise<void>;

  // Alerts
  listAlerts(resolved?: boolean, severity?: string): Promise<FleetAlertResponse[]>;
  resolveAlert(id: string): Promise<FleetAlertResponse>;

  // OTA
  pushOTAUpdate(req: OTAUpdateRequest): Promise<{ status: string; command_count: number }>;
}

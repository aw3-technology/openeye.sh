/**
 * Fleet Management client — Hybrid facade.
 *
 * - Cloud/production mode → uses Supabase directly (CloudFleetClient)
 * - Local/development mode → hits the local Python fleet server via HTTP (LocalFleetClient)
 *
 * Detection is automatic via VITE_DEPLOY_ENV / hostname (see deployment-env.ts).
 * No additional env variables needed.
 */

import { isCloudDeployment } from "./deployment-env";
import { CloudFleetClient } from "./fleet-client-cloud";
import { LocalFleetClient } from "./fleet-client-local";
import type { FleetClientInterface } from "./fleet-client-interface";

// Singleton — created once based on deployment mode
let _client: FleetClientInterface | null = null;

export function getFleetClient(): FleetClientInterface {
  if (!_client) {
    _client = isCloudDeployment() ? new CloudFleetClient() : new LocalFleetClient();
  }
  return _client;
}

/** Reset client (e.g. when fleet server URL changes in local mode) */
export function resetFleetClient() {
  _client = null;
}

// ── Re-export convenience functions that delegate to the singleton ──

const c = () => getFleetClient();

export const registerDevice: FleetClientInterface["registerDevice"] = (...a) => c().registerDevice(...a);
export const listDevices: FleetClientInterface["listDevices"] = (...a) => c().listDevices(...a);
export const getDevice: FleetClientInterface["getDevice"] = (...a) => c().getDevice(...a);
export const updateDevice: FleetClientInterface["updateDevice"] = (...a) => c().updateDevice(...a);
export const setTags: FleetClientInterface["setTags"] = (...a) => c().setTags(...a);
export const setConfigOverrides: FleetClientInterface["setConfigOverrides"] = (...a) => c().setConfigOverrides(...a);
export const getResourceHistory: FleetClientInterface["getResourceHistory"] = (...a) => c().getResourceHistory(...a);
export const restartDevice: FleetClientInterface["restartDevice"] = (...a) => c().restartDevice(...a);
export const decommissionDevice: FleetClientInterface["decommissionDevice"] = (...a) => c().decommissionDevice(...a);
export const batchOperation: FleetClientInterface["batchOperation"] = (...a) => c().batchOperation(...a);

export const createDeployment: FleetClientInterface["createDeployment"] = (...a) => c().createDeployment(...a);
export const listDeployments: FleetClientInterface["listDeployments"] = (...a) => c().listDeployments(...a);
export const getDeployment: FleetClientInterface["getDeployment"] = (...a) => c().getDeployment(...a);
export const getDeploymentDevices: FleetClientInterface["getDeploymentDevices"] = (...a) => c().getDeploymentDevices(...a);
export const advanceDeployment: FleetClientInterface["advanceDeployment"] = (...a) => c().advanceDeployment(...a);
export const pauseDeployment: FleetClientInterface["pauseDeployment"] = (...a) => c().pauseDeployment(...a);
export const rollbackDeployment: FleetClientInterface["rollbackDeployment"] = (...a) => c().rollbackDeployment(...a);

export const createGroup: FleetClientInterface["createGroup"] = (...a) => c().createGroup(...a);
export const listGroups: FleetClientInterface["listGroups"] = (...a) => c().listGroups(...a);
export const getGroup: FleetClientInterface["getGroup"] = (...a) => c().getGroup(...a);
export const deleteGroup: FleetClientInterface["deleteGroup"] = (...a) => c().deleteGroup(...a);
export const addGroupMember: FleetClientInterface["addGroupMember"] = (...a) => c().addGroupMember(...a);
export const removeGroupMember: FleetClientInterface["removeGroupMember"] = (...a) => c().removeGroupMember(...a);
export const listGroupMembers: FleetClientInterface["listGroupMembers"] = (...a) => c().listGroupMembers(...a);
export const setScalingPolicy: FleetClientInterface["setScalingPolicy"] = (...a) => c().setScalingPolicy(...a);

export const createMaintenanceWindow: FleetClientInterface["createMaintenanceWindow"] = (...a) => c().createMaintenanceWindow(...a);
export const listMaintenanceWindows: FleetClientInterface["listMaintenanceWindows"] = (...a) => c().listMaintenanceWindows(...a);
export const updateMaintenanceWindow: FleetClientInterface["updateMaintenanceWindow"] = (...a) => c().updateMaintenanceWindow(...a);
export const deleteMaintenanceWindow: FleetClientInterface["deleteMaintenanceWindow"] = (...a) => c().deleteMaintenanceWindow(...a);

export const listAlerts: FleetClientInterface["listAlerts"] = (...a) => c().listAlerts(...a);
export const resolveAlert: FleetClientInterface["resolveAlert"] = (...a) => c().resolveAlert(...a);

export const pushOTAUpdate: FleetClientInterface["pushOTAUpdate"] = (...a) => c().pushOTAUpdate(...a);
